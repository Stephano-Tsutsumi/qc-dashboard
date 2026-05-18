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
const REF_PARAM = 'ref'

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
  refParam,
}: {
  snapshots: TrackerSnapshotOption[]
  weekSelectValue: string
  hasSnapshots: boolean
  refParam: string
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

  const snapshotActive = weekSelectValue !== 'catalog'

  const setRef = (value: string) => {
    pushParams((p) => {
      const trimmed = value.trim()
      if (trimmed) p.set(REF_PARAM, trimmed)
      else p.delete(REF_PARAM)
    })
  }

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
      <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 sm:max-w-sm">
        <label htmlFor="ref-search" className="text-xs font-medium text-text-secondary">
          Search by interaction ID
        </label>
        <input
          id="ref-search"
          type="search"
          inputMode="numeric"
          defaultValue={refParam}
          disabled={pending || !snapshotActive}
          placeholder="e.g. 704262586987"
          className="rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text shadow-sm placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setRef((e.target as HTMLInputElement).value)
            }
          }}
          onBlur={(e) => setRef(e.target.value)}
        />
        {!snapshotActive ? (
          <p className="text-[11px] text-text-muted">
            Select a report / import above to enable interaction ID search.
          </p>
        ) : refParam ? (
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-text-muted">
              Showing issues containing <span className="mono font-medium text-text">{refParam}</span>
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRef('')}
              className="text-[11px] font-medium text-accent underline underline-offset-2 hover:opacity-90"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">Press Enter to search.</p>
        )}
      </div>

      {pending ? <p className="mt-3 text-xs text-text-muted">Updating…</p> : null}
    </div>
  )
}
