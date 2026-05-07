import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ISSUE_BY_ID } from '@/lib/issues'

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    p0: 'bg-p0-bg text-p0 border-p0-border',
    p1: 'bg-p1-bg text-p1 border-p1-border',
    p2: 'bg-p2-bg text-p2 border-p2-border',
    p3: 'bg-p3-bg text-p3 border-p3-border',
  }
  return map[p] ?? 'bg-surface-2 text-text border-border'
}

export default async function DashboardPage() {
  const supabase = createClient(cookies())
  const { data: rows } = await supabase.from('issues').select(`
      id,
      priority,
      title,
      issue_states ( status, jira_ticket, updated_at )
    `)

  const issues = rows ?? []
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
          Issue catalogue with collaboration state (full UI parity with v4 HTML is next).
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

      <ul className="space-y-2">
        {issues.map((row) => {
          const state = Array.isArray(row.issue_states)
            ? row.issue_states[0]
            : row.issue_states
          const def = ISSUE_BY_ID[row.id]
          return (
            <li
              key={row.id}
              className="rounded border border-border bg-surface p-4 shadow-sm"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${priorityBadge(row.priority)}`}
                  >
                    {row.priority.toUpperCase()}
                  </span>
                  <h2 className="mt-2 font-medium text-text">{row.title}</h2>
                  {def && (
                    <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                      {def.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-text-muted">
                  <div>Status: {state?.status ?? 'open'}</div>
                  {state?.jira_ticket && <div className="mono mt-1">{state.jira_ticket}</div>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
