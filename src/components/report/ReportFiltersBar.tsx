'use client'

import type { DashboardWeekInsights } from '@/lib/snapshot-stats'
import type { SnapshotScoreBucketKey } from '@/types/csv'
import {
  PRIORITY_FILTER_LABEL,
  PRIORITY_ORDER,
} from '@/lib/priority-sections'
import type { ReportFilterState } from '@/lib/filter-issues'
import { cn } from '@/lib/utils'

type ScoreDistribution = DashboardWeekInsights['scoreDistribution']

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-2/60'
      )}
    >
      {children}
    </button>
  )
}

function ScoreSegment({
  label,
  count,
  heightPx,
  active,
  barColor,
  onClick,
}: {
  label: string
  count: number
  heightPx: number
  active: boolean
  barColor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-[52px] flex-col items-center gap-1 rounded-md border px-1.5 py-1 transition-colors',
        active ? 'border-text bg-surface-2' : 'border-transparent hover:bg-surface-2/40'
      )}
    >
      <div className="flex h-8 w-full items-end justify-center">
        <div
          className="w-full max-w-[28px] rounded-t-[2px]"
          style={{
            height: `${heightPx}px`,
            minHeight: '3px',
            backgroundColor: barColor,
          }}
        />
      </div>
      <span className="mono text-[10px] tabular-nums text-text-muted">{count}</span>
      <span className="mono text-[9px] leading-tight text-text-muted">{label}</span>
    </button>
  )
}

type Axis = keyof ReportFilterState

export function ReportFiltersBar({
  filters,
  scoreDistribution,
  onFilterChange,
}: {
  filters: ReportFilterState
  scoreDistribution: ScoreDistribution
  onFilterChange: (axis: Axis, value: string) => void
}) {
  const totalCalls = Object.values(scoreDistribution).reduce((s, d) => s + d.count, 0)

  const scoreConfigs: Array<{
    key: SnapshotScoreBucketKey | 'all'
    label: string
    color: string
  }> = [
    { key: 'all', label: 'All', color: 'var(--text-muted)' },
    { key: 'lte50', label: '≤50%', color: '#a32d2d' },
    { key: 'lte60', label: '51–60%', color: '#e2693a' },
    { key: 'lte70', label: '61–70%', color: '#e2a83a' },
    { key: 'lte75', label: '71–75%', color: '#97c459' },
    { key: 'pass', label: '76–100%', color: '#378add' },
  ]

  return (
    <div className="space-y-0 rounded-[var(--radius)] border border-border bg-surface px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border py-2">
        <span className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Priority
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Pill active={filters.priority === 'all'} onClick={() => onFilterChange('priority', 'all')}>
            All
          </Pill>
          {PRIORITY_ORDER.map((p) => (
            <Pill
              key={p}
              active={filters.priority === p}
              onClick={() => onFilterChange('priority', p)}
            >
              {PRIORITY_FILTER_LABEL[p]}
            </Pill>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border py-2">
        <span className="w-[72px] shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Channel
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Pill active={filters.channel === 'all'} onClick={() => onFilterChange('channel', 'all')}>
            All
          </Pill>
          <Pill
            active={filters.channel === 'chat'}
            onClick={() => onFilterChange('channel', 'chat')}
          >
            AVA (Chat)
          </Pill>
          <Pill
            active={filters.channel === 'voice'}
            onClick={() => onFilterChange('channel', 'voice')}
          >
            IVA (Voice)
          </Pill>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 py-2">
        <span className="w-[72px] shrink-0 self-center text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Score
        </span>
        <div className="flex flex-wrap items-end gap-1">
          {scoreConfigs.map(({ key, label, color }) => {
            if (key === 'all') {
              return (
                <ScoreSegment
                  key={key}
                  label={label}
                  count={totalCalls}
                  heightPx={28}
                  active={filters.score === 'all'}
                  barColor={color}
                  onClick={() => onFilterChange('score', 'all')}
                />
              )
            }
            const d = scoreDistribution[key]
            return (
              <ScoreSegment
                key={key}
                label={label}
                count={d.count}
                heightPx={d.heightPx}
                active={filters.score === key}
                barColor={color}
                onClick={() => onFilterChange('score', key)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
