'use client'

import { useMemo, useState } from 'react'
import type { Priority } from '@/types/issue'
import type { IssueDef } from '@/lib/issues'
import {
  PRIORITY_FILTER_LABEL,
  PRIORITY_ORDER,
  PRIORITY_SECTION_TITLE,
  isPriority,
} from '@/lib/priority-sections'
import { IssueCard } from '@/components/report/IssueCard'
import { cn } from '@/lib/utils'

export type QcReportIssueItem = {
  id: string
  priority: Priority | string
  title: string
  description: string
  status: string | null | undefined
  jiraTicket: string | null | undefined
  commentCount: number
  evidence: IssueDef['evidence']
  weekImportSignal?: { callCount: number; section: string; interactionIds?: string[] } | null
}

type Filter = 'all' | Priority

function groupByPriority(items: QcReportIssueItem[]): Record<Priority, QcReportIssueItem[]> {
  const out: Record<Priority, QcReportIssueItem[]> = {
    p0: [],
    p1: [],
    p2: [],
    p3: [],
  }
  for (const item of items) {
    const raw = String(item.priority).toLowerCase()
    if (isPriority(raw)) out[raw].push(item)
  }
  return out
}

function SectionChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 text-text-muted transition-transform duration-200',
        expanded && 'rotate-180'
      )}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 8l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function SectionHeaderInner({
  p,
  count,
  showChevron,
  expanded,
  headingId,
  titleVariant,
}: {
  p: Priority
  count: number
  showChevron: boolean
  expanded: boolean
  headingId: string
  titleVariant: 'in-button' | 'heading'
}) {
  const title = PRIORITY_SECTION_TITLE[p]
  return (
    <>
      <span
        className={cn(
          'inline-flex min-w-[2rem] justify-center rounded-sm border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
          p === 'p0' && 'border-p0-border bg-p0-bg text-p0',
          p === 'p1' && 'border-p1-border bg-p1-bg text-p1',
          p === 'p2' && 'border-p2-border bg-p2-bg text-p2',
          p === 'p3' && 'border-p3-border bg-p3-bg text-p3'
        )}
      >
        {PRIORITY_FILTER_LABEL[p]}
      </span>
      <div className="min-w-0 flex-1">
        {titleVariant === 'heading' ? (
          <h2 id={headingId} className="text-sm font-semibold text-text">
            {title}
          </h2>
        ) : (
          <span
            id={headingId}
            role="heading"
            aria-level={2}
            className="block text-sm font-semibold text-text"
          >
            {title}
          </span>
        )}
      </div>
      <span className="tabular-nums text-sm font-medium text-text-secondary">{count}</span>
      {showChevron ? <SectionChevron expanded={expanded} /> : null}
    </>
  )
}

export function QcReportSections({ items }: { items: QcReportIssueItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [openSection, setOpenSection] = useState<Record<Priority, boolean>>({
    p0: true,
    p1: true,
    p2: true,
    p3: true,
  })

  const grouped = useMemo(() => groupByPriority(items), [items])

  const visiblePriorities: Priority[] =
    filter === 'all' ? [...PRIORITY_ORDER] : [filter]

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by priority"
      >
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        {PRIORITY_ORDER.map((p) => (
          <FilterChip key={p} active={filter === p} onClick={() => setFilter(p)}>
            {PRIORITY_FILTER_LABEL[p]}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-4">
        {visiblePriorities.map((p) => {
          const list = grouped[p]
          const count = list.length
          if (filter === 'all' && count === 0) return null

          const expanded = filter !== 'all' || openSection[p]
          const panelId = `qc-section-${p}-panel`
          const headingId = `qc-section-${p}-heading`

          return (
            <section
              key={p}
              className="overflow-hidden rounded border border-border bg-surface shadow-sm"
              style={{ borderRadius: 'var(--radius)' }}
              aria-labelledby={headingId}
            >
              {filter === 'all' ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpenSection((s) => ({ ...s, [p]: !s[p] }))}
                >
                  <SectionHeaderInner
                    p={p}
                    count={count}
                    showChevron
                    expanded={expanded}
                    headingId={headingId}
                    titleVariant="in-button"
                  />
                </button>
              ) : (
                <div
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  aria-controls={panelId}
                >
                  <SectionHeaderInner
                    p={p}
                    count={count}
                    showChevron={false}
                    expanded
                    headingId={headingId}
                    titleVariant="heading"
                  />
                </div>
              )}

              <div id={panelId} role="region" aria-labelledby={headingId} hidden={!expanded}>
                {count === 0 ? (
                  <p className="border-t border-border px-4 py-6 text-sm text-text-secondary">
                    No issues in this group.
                  </p>
                ) : (
                  <ul className="space-y-3 border-t border-border bg-[var(--surface-2)]/25 p-3">
                    {list.map((row) => (
                      <li key={row.id}>
                        <IssueCard
                          id={row.id}
                          priority={row.priority}
                          title={row.title}
                          description={row.description}
                          status={row.status}
                          jiraTicket={row.jiraTicket}
                          commentCount={row.commentCount}
                          evidence={row.evidence}
                          weekImportSignal={row.weekImportSignal}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-2/60 hover:text-text'
      )}
    >
      {children}
    </button>
  )
}
