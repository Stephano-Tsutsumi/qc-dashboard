'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import type { IssueStatus } from '@/types/issue'
import { ISSUE_STATUS_OPTIONS } from '@/types/issue'
import { cn } from '@/lib/utils'

export type TrackerSnapshotOption = {
  id: string
  label: string
  report_date: string
}

const STATUS_PARAM = 'status'

function parseStatusesFromSearch(search: URLSearchParams): Set<IssueStatus> {
  const raw = search.get(STATUS_PARAM)
  if (!raw?.trim()) return new Set()
  const next = new Set<IssueStatus>()
  for (const part of raw.split(',')) {
    const v = part.trim() as IssueStatus
    if (v === 'open' || v === 'in-progress' || v === 'resolved' || v === 'blocked') next.add(v)
  }
  return next
}

export function TrackerFilters({
  snapshots,
  weekSelectValue,
  hasSnapshots,
}: {
  snapshots: TrackerSnapshotOption[]
  weekSelectValue: string
  hasSnapshots: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const selectedStatuses = parseStatusesFromSearch(searchParams)

  const pushParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString())
      mutate(p)
      const q = p.toString()
      startTransition(() => {
        router.replace(q ? `/dashboard/tracker?${q}` : '/dashboard/tracker')
      })
    },
    [router, searchParams]
  )

  const toggleStatus = (value: IssueStatus) => {
    pushParams((p) => {
      const cur = parseStatusesFromSearch(p)
      if (cur.has(value)) cur.delete(value)
      else cur.add(value)
      if (cur.size === 0) p.delete(STATUS_PARAM)
      else p.set(STATUS_PARAM, [...cur].sort().join(','))
    })
  }

  const clearStatuses = () => {
    pushParams((p) => {
      p.delete(STATUS_PARAM)
    })
  }

  return (
    <div
      className="rounded border border-border bg-surface p-4 shadow-sm"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex max-w-md flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">Report / import</span>
          <select
            className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
            value={weekSelectValue}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value
              pushParams((p) => {
                if (v === 'catalog') p.set('week', 'catalog')
                else p.set('week', v)
              })
            }}
          >
            <option value="catalog">All imports (full catalog)</option>
            {hasSnapshots ? (
              <>
                <option value="latest">Latest import</option>
                <optgroup label="Saved snapshots">
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} · {s.report_date}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : null}
          </select>
        </label>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-secondary">Status</span>
            {ISSUE_STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => toggleStatus(value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selectedStatuses.has(value)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-surface-2 text-text-secondary hover:border-border-strong hover:text-text'
                )}
              >
                {label}
              </button>
            ))}
            {selectedStatuses.size > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={clearStatuses}
                className="text-xs font-medium text-accent underline underline-offset-2 hover:opacity-90"
              >
                Clear status filters
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {pending ? <p className="mt-3 text-xs text-text-muted">Updating…</p> : null}
    </div>
  )
}
