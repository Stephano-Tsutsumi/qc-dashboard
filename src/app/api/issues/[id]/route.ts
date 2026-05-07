import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { IssueStatus } from '@/types/issue'

const ALLOWED: IssueStatus[] = ['open', 'in-progress', 'resolved', 'blocked']

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const { id } = context.params
  const supabase = createClient(cookies())
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { status?: IssueStatus; jira_ticket?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: existing } = await supabase.from('issues').select('id').eq('id', id).maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const { data: stateRow } = await supabase
    .from('issue_states')
    .select('issue_id, status, jira_ticket')
    .eq('issue_id', id)
    .maybeSingle()

  const nextStatus = body.status ?? (stateRow?.status as IssueStatus) ?? 'open'
  const nextJira =
    body.jira_ticket !== undefined ? body.jira_ticket : stateRow?.jira_ticket ?? null

  if (body.status && !ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const userName =
    session.user.user_metadata?.full_name ??
    session.user.email ??
    session.user.id.slice(0, 8)

  const { error: upsertError } = await supabase.from('issue_states').upsert(
    {
      issue_id: id,
      status: nextStatus,
      jira_ticket: nextJira,
      updated_by: session.user.id,
    },
    { onConflict: 'issue_id' }
  )

  if (upsertError) {
    console.error(upsertError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  if (body.status && body.status !== stateRow?.status) {
    await supabase.from('activity_log').insert({
      issue_id: id,
      user_id: session.user.id,
      user_name: userName,
      type: 'status',
      description: `Status → ${body.status}`,
    })
  }

  if (body.jira_ticket !== undefined && body.jira_ticket !== stateRow?.jira_ticket) {
    await supabase.from('activity_log').insert({
      issue_id: id,
      user_id: session.user.id,
      user_name: userName,
      type: 'jira',
      description: `Jira → ${body.jira_ticket ?? 'cleared'}`,
    })
  }

  return NextResponse.json({ ok: true })
}
