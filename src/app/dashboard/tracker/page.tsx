import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function TrackerPage() {
  const supabase = createClient(cookies())
  const { data: states } = await supabase.from('issue_states').select('status, issue_id')
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('label, report_date, call_count, avg_score')
    .order('report_date', { ascending: false })
    .limit(12)

  const resolved = (states ?? []).filter((s) => s.status === 'resolved').length
  const total = states?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ticket Tracker</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Resolution progress and recent weekly snapshots.
        </p>
      </div>

      <div
        className="rounded border border-border bg-surface p-6 shadow-sm"
        style={{ borderRadius: 'var(--radius)' }}
      >
        <div className="text-sm text-text-secondary">Resolved issues</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">
          {resolved} / {total}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-secondary">Recent imports</h2>
        <ul className="mt-2 divide-y divide-border rounded border border-border bg-surface">
          {(weeks ?? []).length === 0 ? (
            <li className="p-4 text-sm text-text-muted">No snapshots yet — use Import CSV.</li>
          ) : (
            (weeks ?? []).map((w) => (
              <li key={w.report_date + w.label} className="flex justify-between gap-4 p-4 text-sm">
                <span className="font-medium text-text">{w.label}</span>
                <span className="text-text-muted">
                  {w.call_count != null ? `${w.call_count} calls` : '—'}
                  {w.avg_score != null ? ` · avg ${Number(w.avg_score).toFixed(1)}%` : ''}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
