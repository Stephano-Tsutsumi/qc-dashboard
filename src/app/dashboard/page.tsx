import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ISSUE_BY_ID } from '@/lib/issues'
import { QcReportSections } from '@/components/report/QcReportSections'
import { QcReportWeekSelector } from '@/components/report/QcReportWeekSelector'
import { buildWeekIssueSignalMapFromStatsJson, parseReviewerNotesFromStatsJson, resolveWeekSelection, type SnapshotListRow } from '@/lib/snapshot-stats'
import { getNotesForIssue } from '@/lib/issueNoteRules'

type SearchParams = Record<string, string | string[] | undefined>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient(cookies())
  const weekRaw = searchParams.week
  const weekParam = Array.isArray(weekRaw) ? weekRaw[0] : weekRaw

  const [{ data: rows }, { data: commentRows }, { data: snapshotRows }] = await Promise.all([
    supabase.from('issues').select(`
        id,
        priority,
        title,
        issue_states ( status, jira_ticket, updated_at )
      `),
    supabase.from('comments').select('issue_id'),
    supabase
      .from('weekly_snapshots')
      .select('id, label, report_date, call_count, avg_score, low_score_count, issues_detected, stats_json')
      .order('report_date', { ascending: false }),
  ])

  const snapshots = (snapshotRows ?? []) as SnapshotListRow[]
  const selection = resolveWeekSelection(weekParam, snapshots)
  const hasSnapshots = snapshots.length > 0

  let weekMap = null as ReturnType<typeof buildWeekIssueSignalMapFromStatsJson> | null
  if (selection.mode === 'week') {
    weekMap = buildWeekIssueSignalMapFromStatsJson(selection.snapshot.stats_json)
  }

  const catalogOnly = selection.mode === 'catalog'
  const issues = rows ?? []
  const issueRows =
    catalogOnly || !weekMap ? issues : issues.filter((r) => weekMap!.has(r.id))

  let weekSelectValue: string
  if (!hasSnapshots) weekSelectValue = 'catalog'
  else if (catalogOnly) weekSelectValue = 'catalog'
  else if (!weekParam || weekParam === 'latest') weekSelectValue = 'latest'
  else weekSelectValue = selection.snapshot.id

  const countByIssue = new Map<string, number>()
  for (const r of commentRows ?? []) {
    countByIssue.set(r.issue_id, (countByIssue.get(r.issue_id) ?? 0) + 1)
  }

  const byP = { p0: 0, p1: 0, p2: 0, p3: 0 }
  for (const i of issueRows) {
    const p = i.priority as keyof typeof byP
    if (p in byP) byP[p]++
  }

  const kpiSnapshot =
    selection.mode === 'week' ? selection.snapshot : snapshots.length > 0 ? snapshots[0]! : null
  const unmatchedWeek =
    selection.mode === 'week' && weekMap !== null && weekMap.size === 0 && hasSnapshots

  const selectorSnapshots = snapshots.map((s) => ({
    id: s.id,
    label: s.label,
    report_date: s.report_date,
  }))

  const snapshotReviewerNotes =
    selection.mode === 'week'
      ? parseReviewerNotesFromStatsJson(selection.snapshot.stats_json)
      : []

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Review Queue</h1>
        </div>
        <QcReportWeekSelector snapshots={selectorSnapshots} value={weekSelectValue} />
      </div>

      {/* CSV summary always visible; values fill in after at least one snapshot is saved */}
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div
            className="rounded border border-border bg-surface px-5 py-5 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="text-3xl font-semibold tabular-nums text-text">
              {kpiSnapshot?.call_count ?? '—'}
            </div>
            <div className="mt-2 text-sm text-text-muted">calls reviewed</div>
          </div>
          <div
            className="rounded border border-border bg-surface px-5 py-5 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="text-3xl font-semibold tabular-nums text-[#9a3412]">
              {kpiSnapshot?.low_score_count ?? '—'}
            </div>
            <div className="mt-2 text-sm text-text-muted">calls scored ≤60%</div>
          </div>
          <div
            className="rounded border border-border bg-surface px-5 py-5 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="text-3xl font-semibold tabular-nums text-text">
              {kpiSnapshot?.issues_detected ?? '—'}
            </div>
            <div className="mt-2 text-sm text-text-muted">action items identified</div>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {kpiSnapshot ? (
            <>
              {catalogOnly ? (
                <>
                  Totals from <span className="font-medium text-text">latest CSV import</span>
                </>
              ) : (
                <>
                  Totals from <span className="font-medium text-text">selected import</span>
                </>
              )}
              {' · '}
              {kpiSnapshot.label} · {kpiSnapshot.report_date}
              {kpiSnapshot.avg_score != null
                ? ` · Avg ${Number(kpiSnapshot.avg_score).toFixed(1)}%`
                : ''}
            </>
          ) : (
            <>
              These totals come from a saved CSV import (not from the live issue list).{' '}
              <a
                href="/dashboard/import"
                className="font-medium text-accent underline underline-offset-2 hover:opacity-90"
              >
                Import CSV
              </a>
              {' '}
              and confirm <span className="font-medium text-text">Save snapshot</span> to populate
              the numbers here.
            </>
          )}
        </p>
      </div>

      {unmatchedWeek ? (
        <div
          className="rounded border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <p className="font-medium">No catalog issues matched this import.</p>
          <p className="mt-2 text-amber-900/90">
            Detection titles from the CSV did not align strongly enough with seeded issue titles.
            Try <span className="font-medium">Full catalog</span>, or tune columns / matching once
            the v4 export shape is fixed.
          </p>
        </div>
      ) : null}

      {issueRows.length === 0 && selection.mode === 'week' && !unmatchedWeek ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => (
              <div
                key={p}
                className="rounded border border-border bg-surface p-4 shadow-sm"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <div className="text-xs font-medium uppercase text-text-muted">{p}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{byP[p]}</div>
                {!catalogOnly ? (
                  <div className="mt-1 text-[10px] text-text-muted">In this import view</div>
                ) : null}
              </div>
            ))}
          </div>

          <QcReportSections
            items={issueRows.map((row) => {
              const state = Array.isArray(row.issue_states)
                ? row.issue_states[0]
                : row.issue_states
              const def = ISSUE_BY_ID[row.id]
              const description = def?.description ?? ''
              const baseEvidence = def?.evidence ?? {
                qcNotes: [{ ref: 'QC', comment: description || 'No description.' }],
                recommendedAction: 'Track and remediate per team process.',
              }

              const csvMatchedNotes =
                !catalogOnly && snapshotReviewerNotes.length > 0
                  ? getNotesForIssue(row.id, snapshotReviewerNotes, 5)
                  : []

              const evidence =
                csvMatchedNotes.length > 0
                  ? {
                      qcNotes: csvMatchedNotes.map((n) => ({
                        ref: n.ref.trim() || 'QC',
                        comment: n.comment.trim(),
                        section: n.section.trim() || undefined,
                      })),
                      recommendedAction: baseEvidence.recommendedAction,
                    }
                  : baseEvidence

              const signal = !catalogOnly && weekMap ? weekMap.get(row.id) : undefined

              return {
                id: row.id,
                priority: row.priority,
                title: row.title,
                description,
                status: state?.status,
                jiraTicket: state?.jira_ticket,
                commentCount: countByIssue.get(row.id) ?? 0,
                evidence,
                weekImportSignal:
                  signal != null
                    ? {
                        callCount: signal.callCount,
                        section: signal.section,
                        interactionIds: signal.interactionIds,
                      }
                    : null,
              }
            })}
          />
        </>
      )}
    </div>
  )
}
