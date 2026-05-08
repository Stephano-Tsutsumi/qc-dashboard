import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ISSUE_BY_ID } from '@/lib/issues'
import { QcReportSections } from '@/components/report/QcReportSections'

export default async function DashboardPage() {
  const supabase = createClient(cookies())

  const [{ data: rows }, { data: commentRows }] = await Promise.all([
    supabase.from('issues').select(`
        id,
        priority,
        title,
        issue_states ( status, jira_ticket, updated_at )
      `),
    supabase.from('comments').select('issue_id'),
  ])

  const issues = rows ?? []
  const countByIssue = new Map<string, number>()
  for (const r of commentRows ?? []) {
    countByIssue.set(r.issue_id, (countByIssue.get(r.issue_id) ?? 0) + 1)
  }

  const byP = { p0: 0, p1: 0, p2: 0, p3: 0 }
  for (const i of issues) {
    const p = i.priority as keyof typeof byP
    if (p in byP) byP[p]++
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text">QC Report</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Filter by priority or expand a section, then a card for QC notes, refs, and collaboration
          (status, Jira, comments with realtime updates). Data definitions live in{' '}
          <code className="mono text-xs">issues.ts</code>. The footer always mirrors the latest status,
          Jira, and comment count while a card is expanded.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => (
          <div
            key={p}
            className="rounded border border-border bg-surface p-4 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="text-xs font-medium uppercase text-text-muted">{p}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{byP[p]}</div>
          </div>
        ))}
      </div>

      <QcReportSections
        items={issues.map((row) => {
          const state = Array.isArray(row.issue_states)
            ? row.issue_states[0]
            : row.issue_states
          const def = ISSUE_BY_ID[row.id]
          const description = def?.description ?? ''
          const evidence = def?.evidence ?? {
            qcNotes: [{ ref: 'QC', comment: description || 'No description.' }],
            recommendedAction: 'Track and remediate per team process.',
          }

          return {
            id: row.id,
            priority: row.priority,
            title: row.title,
            description,
            status: state?.status,
            jiraTicket: state?.jira_ticket,
            commentCount: countByIssue.get(row.id) ?? 0,
            evidence,
          }
        })}
      />
    </div>
  )
}
