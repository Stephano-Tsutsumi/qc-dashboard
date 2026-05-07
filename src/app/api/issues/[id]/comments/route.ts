import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { initialsFromName } from '@/lib/utils'

export async function GET(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params
  const supabase = createClient(cookies())
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('issue_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const { id } = context.params
  const supabase = createClient(cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = body.body?.trim()
  if (!text) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }

  const userName =
    user.user_metadata?.full_name ?? user.email ?? user.id.slice(0, 8)

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({
      issue_id: id,
      user_id: user.id,
      user_name: userName,
      user_initials: initialsFromName(userName),
      body: text,
    })
    .select()
    .single()

  if (error || !inserted) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }

  await supabase.from('activity_log').insert({
    issue_id: id,
    user_id: user.id,
    user_name: userName,
    type: 'comment',
    description: text.slice(0, 200),
  })

  return NextResponse.json({ comment: inserted })
}
