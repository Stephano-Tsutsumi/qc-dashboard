import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import {
  buildWeekIssueSignalMapFromStatsJson,
  getIssueIdsFromStatsJson,
  resolveWeekSelection,
  type SnapshotListRow,
  type WeekIssueSignal,
} from '@/lib/snapshot-stats'
import { PRIORITY_ORDER, PRIORITY_SECTION_TITLE, isPriority } from '@/lib/priority-sections'
import type { IssueStatus, Priority } from '@/types/issue'
import { normalizeIssueStatus } from '@/types/issue'
import { StatusPill } from '@/components/ui/StatusPill'
import { TrackerFilters } from '@/components/tracker/TrackerFilters'

type SearchParams = Record<string, string | string[] | undefined>

function parseStatusParam(raw: string | string[] | undefined): Set<IssueStatus> | null {
  const s = Array.isArray(raw) ? raw[0] : raw
  if (!s?.trim()) return null
  const out = new Set<IssueStatus>()
  for (const part of s.split(',')) {
    const v = part.trim() as IssueStatus
    if (v === 'open' || v === 'in-progress' || v === 'resolved' || v === 'blocked') out.add(v)
  }
  return out.size ? out : null
}

function jiraTicketHref(raw: string | null): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  return null
}

function dashboardIssueHref(issueId: string, weekSelectValue: string): string {
  const params = new URLSearchParams()
  if (weekSelectValue === 'catalog') params.set('week', 'catalog')
  else if (weekSelectValue === 'latest') params.set('week', 'latest')
  else if (weekSelectValue) params.set('week', weekSelectValue)
  const q = params.toString()
  return `${q ? `/dashboard?${q}` : '/dashboard'}#issue-${issueId}`
}

type TrackerRow = {
  id: string
  priority: string
  title: string
  status: IssueStatus
  jira_ticket: string | null
  updated_at: string | null
  commentCount: number
  importCalls: number | null
  lastActivity: string | null
}

function groupRowsByPriority(rows: TrackerRow[]): Record<Priority, TrackerRow[]> {
  const out: Record<Priority, TrackerRow[]> = { p0: [], p1: [], p2: [], p3: [] }
  for (const r of rows) {
    const p = String(r.priority).toLowerCase()
    if (isPriority(p)) out[p].push(r)
  }
  return out
}

export default async function TrackerPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient(cookies())
  const weekRaw = searchParams.week
  const weekParam = Array.isArray(weekRaw) ? weekRaw[0] : weekRaw
  const statusFilter = parseStatusParam(searchParams.status)
  const refParam = ((Array.isArray(searchParams.ref) ? searchParams.ref[0] : searchParams.ref) ?? '').trim()

  const [
    { data: issuesRows },
    { data: statesRows },
    { data: snapshotRows },
    { data: commentRows },
    { data: activityRows },
  ] = await Promise.all([
    supabase.from('issues').select('id, priority, title').order('priority', { ascending: true }).order('title'),
    supabase.from('issue_states').select('issue_id, status, jira_ticket, updated_at'),
    supabase
      .from('weekly_snapshots')
      .select('id, label, report_date, stats_json')
      .order('report_date', { ascending: false }),
    supabase.from('comments').select('issue_id'),
    supabase
      .from('activity_log')
      .select('issue_id, description, created_at')
      .order('created_at', { ascending: false })
      .limit(400),
  ])

  const snapshots = (snapshotRows ?? []) as SnapshotListRow[]
  const hasSnapshots = snapshots.length > 0

  let weekSelectValue: string
  if (!hasSnapshots) weekSelectValue = 'catalog'
  else if (!weekParam || weekParam === 'catalog') weekSelectValue = 'catalog'
  else if (weekParam === 'latest') weekSelectValue = 'latest'
  else if (snapshots.some((s) => s.id === weekParam)) weekSelectValue = weekParam
  else weekSelectValue = 'catalog'

  let importIssueIds: Set<string> | null = null
  let weekSignalMap: Map<string, WeekIssueSignal> | null = null
  let selectedSnapshotLabel: string | null = null

  if (hasSnapshots && weekSelectValue !== 'catalog') {
    const sel = resolveWeekSelection(weekSelectValue, snapshots)
    if (sel.mode === 'week') {
      importIssueIds = getIssueIdsFromStatsJson(sel.snapshot.stats_json)
      weekSignalMap = buildWeekIssueSignalMapFromStatsJson(sel.snapshot.stats_json)
      selectedSnapshotLabel = `${sel.snapshot.label} · ${sel.snapshot.report_date}`
    }
  }

  const stateByIssue = new Map(
    (statesRows ?? []).map((s) => [
      s.issue_id,
      {
        status: normalizeIssueStatus(s.status),
        jira_ticket: s.jira_ticket,
        updated_at: s.updated_at,
      },
    ])
  )

  const commentCountByIssue = new Map<string, number>()
  for (const c of commentRows ?? []) {
    commentCountByIssue.set(c.issue_id, (commentCountByIssue.get(c.issue_id) ?? 0) + 1)
  }

  const latestActivityByIssue = new Map<string, string>()
  for (const a of activityRows ?? []) {
    if (!latestActivityByIssue.has(a.issue_id)) {
      latestActivityByIssue.set(a.issue_id, a.description)
    }
  }

  const baseRows: TrackerRow[] = (issuesRows ?? []).map((issue) => {
    const st = stateByIssue.get(issue.id)
    return {
      id: issue.id,
      priority: issue.priority,
      title: issue.title,
      status: st?.status ?? 'open',
      jira_ticket: st?.jira_ticket ?? null,
      updated_at: st?.updated_at ?? null,
      commentCount: commentCountByIssue.get(issue.id) ?? 0,
      importCalls: weekSignalMap?.get(issue.id)?.callCount ?? null,
      lastActivity: latestActivityByIssue.get(issue.id) ?? null,
    }
  })

  let refMatchIssueIds: Set<string> | null = null
  if (refParam && weekSignalMap) {
    refMatchIssueIds = new Set()
    for (const [issueId, signal] of weekSignalMap) {
      if (signal.interactionIds?.some((id) => id.trim() === refParam)) {
        refMatchIssueIds.add(issueId)
      }
    }
  }

  let rows = baseRows
  if (importIssueIds) {
    rows = rows.filter((r) => importIssueIds!.has(r.id))
  }
  if (statusFilter) {
    rows = rows.filter((r) => statusFilter.has(r.status))
  }
  if (refMatchIssueIds !== null) {
    rows = rows.filter((r) => refMatchIssueIds!.has(r.id))
  }

  const grouped = groupRowsByPriority(rows)

  const resolvedInFilter = rows.filter((r) => r.status === 'resolved').length
  const totalInFilter = rows.length
  const statusCounts = { open: 0, 'in-progress': 0, resolved: 0, blocked: 0 } as Record<IssueStatus, number>
  for (const r of rows) {
    statusCounts[r.status]++
  }

  const unmatchedImport =
    hasSnapshots &&
    weekSelectValue !== 'catalog' &&
    importIssueIds &&
    importIssueIds.size === 0

  const snapshotOptions = snapshots.map((s) => ({
    id: s.id,
    label: s.label,
    report_date: s.report_date,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Ticket Tracker</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Jira / ticket linkage per catalog issue. Filter by collaboration status and by CSV import (see
          Review Queue for narrative evidence).
        </p>
      </div>

      <Suspense
        fallback={
          <div
            className="rounded border border-border bg-surface p-4 text-sm text-text-muted"
            style={{ borderRadius: 'var(--radius)' }}
          >
            Loading filters…
          </div>
        }
      >
        <TrackerFilters
          snapshots={snapshotOptions}
          weekSelectValue={weekSelectValue}
          hasSnapshots={hasSnapshots}
          refParam={refParam}
        />
      </Suspense>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div
          className="rounded border border-border bg-surface p-4 shadow-sm"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <div className="text-xs font-medium text-text-secondary">Issues in view</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{totalInFilter}</div>
        </div>
        {(['open', 'in-progress', 'blocked', 'resolved'] as const).map((key) => (
          <div
            key={key}
            className="rounded border border-border bg-surface p-4 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div className="text-xs font-medium capitalize text-text-secondary">
              {key === 'in-progress' ? 'In progress' : key}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-text">
              {statusCounts[key]}
            </div>
          </div>
        ))}
      </div>

      {totalInFilter > 0 ? (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text">{resolvedInFilter}</span> resolved in this view (
          {totalInFilter} total).
        </p>
      ) : null}

      {selectedSnapshotLabel ? (
        <p className="text-xs text-text-muted">
          Import filter: <span className="font-medium text-text">{selectedSnapshotLabel}</span>
          {weekSignalMap && weekSignalMap.size > 0 ? (
            <span> — {weekSignalMap.size} catalog issue{weekSignalMap.size === 1 ? '' : 's'} with linkage</span>
          ) : null}
        </p>
      ) : null}

      {unmatchedImport ? (
        <div
          className="rounded border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <p className="font-medium">No catalog linkage for this import.</p>
          <p className="mt-2 text-amber-900/90">
            Detection data in this snapshot did not match seeded issues. Try{' '}
            <strong>All imports (full catalog)</strong> or another snapshot.
          </p>
        </div>
      ) : null}

      {refParam && weekSelectValue === 'catalog' ? (
        <div
          className="rounded border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          style={{ borderRadius: 'var(--radius)' }}
        >
          Select a report / import to search by interaction ID. Interaction IDs are only available when a snapshot is selected.
        </div>
      ) : null}

      {refParam && weekSelectValue !== 'catalog' && refMatchIssueIds !== null && refMatchIssueIds.size === 0 ? (
        <div
          className="rounded border border-border bg-surface px-4 py-3 text-sm text-text-secondary"
          style={{ borderRadius: 'var(--radius)' }}
        >
          No catalog issues contain interaction ID{' '}
          <span className="mono font-medium text-text">{refParam}</span> in this import.
        </div>
      ) : null}

      {!unmatchedImport && totalInFilter === 0 && !refParam ? (
        <p className="rounded border border-border bg-surface px-4 py-6 text-sm text-text-secondary">
          No issues match the current filters. Clear status filters or choose a different import.
        </p>
      ) : null}

      {!unmatchedImport && totalInFilter > 0
        ? PRIORITY_ORDER.map((p) => {
            const list = grouped[p]
            if (list.length === 0) return null
            return (
              <section key={p} className="space-y-3">
                <h2 className="text-sm font-semibold text-text">{PRIORITY_SECTION_TITLE[p]}</h2>
                <div
                  className="overflow-x-auto rounded border border-border bg-surface shadow-sm"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-[var(--surface-2)]/50 text-xs text-text-muted">
                        <th className="px-3 py-2 font-medium">Issue</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Jira / ticket</th>
                        {weekSelectValue !== 'catalog' && weekSignalMap ? (
                          <th className="px-3 py-2 font-medium tabular-nums">Interactions (import)</th>
                        ) : null}
                        <th className="px-3 py-2 font-medium tabular-nums">Comments</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                        <th className="px-3 py-2 font-medium">Latest activity</th>
                        <th className="px-3 py-2 font-medium">Review Queue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => {
                        const jiraHref = jiraTicketHref(row.jira_ticket)
                        const updated = row.updated_at
                          ? new Date(row.updated_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'
                        return (
                          <tr key={row.id} className="border-b border-border last:border-0">
                            <td className="max-w-md px-3 py-3 align-top">
                              <div className="font-medium text-text">{row.title}</div>
                              <div className="mono mt-0.5 text-[11px] text-text-muted">{row.id}</div>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <StatusPill status={row.status} />
                            </td>
                            <td className="max-w-[200px] px-3 py-3 align-top">
                              {row.jira_ticket?.trim() ? (
                                jiraHref ? (
                                  <a
                                    href={jiraHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all text-accent underline underline-offset-2 hover:opacity-90"
                                  >
                                    {row.jira_ticket.trim()}
                                  </a>
                                ) : (
                                  <span className="break-all font-mono text-xs text-text-secondary">
                                    {row.jira_ticket.trim()}
                                  </span>
                                )
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                            {weekSelectValue !== 'catalog' && weekSignalMap ? (
                              <td className="px-3 py-3 align-top tabular-nums text-text-secondary">
                                {row.importCalls != null ? row.importCalls : '—'}
                              </td>
                            ) : null}
                            <td className="px-3 py-3 align-top tabular-nums text-text-secondary">
                              {row.commentCount}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-text-secondary">
                              {updated}
                            </td>
                            <td className="max-w-[220px] px-3 py-3 align-top text-xs text-text-secondary">
                              {row.lastActivity ? (
                                <span className="line-clamp-2" title={row.lastActivity}>
                                  {row.lastActivity}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Link
                                href={dashboardIssueHref(row.id, weekSelectValue)}
                                className="text-xs font-medium text-accent underline underline-offset-2 hover:opacity-90"
                              >
                                Open issue
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })
        : null}
    </div>
  )
}
