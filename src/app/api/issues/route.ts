import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { IssueRow } from '@/types/issue'

export async function GET() {
  const supabase = createClient(cookies())

  const { data: issues, error: issuesError } = await supabase.from('issues').select(`
      id,
      priority,
      title,
      description,
      issue_states (
        status,
        jira_ticket,
        updated_at
      )
    `)

  if (issuesError || !issues) {
    console.error(issuesError)
    return NextResponse.json({ error: 'Failed to load issues' }, { status: 500 })
  }

  const { data: commentRows } = await supabase.from('comments').select('issue_id')
  const countByIssue = new Map<string, number>()
  for (const r of commentRows ?? []) {
    countByIssue.set(r.issue_id, (countByIssue.get(r.issue_id) ?? 0) + 1)
  }

  const mapped: IssueRow[] = issues.map((row) => {
    const state = Array.isArray(row.issue_states)
      ? row.issue_states[0]
      : row.issue_states
    return {
      id: row.id,
      priority: row.priority as IssueRow['priority'],
      title: row.title,
      description: row.description ?? '',
      status: (state?.status as IssueRow['status']) ?? 'open',
      jira_ticket: state?.jira_ticket ?? null,
      updated_at: state?.updated_at ?? new Date().toISOString(),
      comment_count: countByIssue.get(row.id) ?? 0,
    }
  })

  return NextResponse.json({ issues: mapped })
}
