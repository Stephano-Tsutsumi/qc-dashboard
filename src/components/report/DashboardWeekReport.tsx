'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DashboardWeekInsights } from '@/lib/snapshot-stats'
import { QcReportSections, type QcReportIssueItem } from '@/components/report/QcReportSections'
import { ChangelogBanner } from '@/components/report/ChangelogBanner'
import { SectionPerformanceChart } from '@/components/report/SectionPerformanceChart'
import { ReportFiltersBar } from '@/components/report/ReportFiltersBar'
import { filterIssueRows, type ReportFilterState } from '@/lib/filter-issues'

export function DashboardWeekReport({
  insights,
  items,
  snapshotKey,
}: {
  insights: DashboardWeekInsights
  items: QcReportIssueItem[]
  snapshotKey: string
}) {
  const [filters, setFilters] = useState<ReportFilterState>({
    priority: 'all',
    channel: 'all',
    score: 'all',
  })

  useEffect(() => {
    setFilters({ priority: 'all', channel: 'all', score: 'all' })
  }, [snapshotKey])

  const filtered = useMemo(() => filterIssueRows(items, filters), [items, filters])

  const noResults = filtered.length === 0 && items.length > 0

  return (
    <div className="space-y-6">
      {insights.changelogItems.length > 0 ? (
        <ChangelogBanner items={insights.changelogItems} />
      ) : null}

      {insights.sectionStatsChart.length > 0 ? (
        <SectionPerformanceChart sections={insights.sectionStatsChart} />
      ) : null}

      <ReportFiltersBar
        filters={filters}
        scoreDistribution={insights.scoreDistribution}
        onFilterChange={(axis, value) =>
          setFilters((prev) => ({ ...prev, [axis]: value }) as ReportFilterState)
        }
      />

      {noResults ? (
        <p className="rounded-[var(--radius)] border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
          No issues match the current filters.
        </p>
      ) : null}

      <QcReportSections items={filtered} hideBuiltInPriorityFilter />
    </div>
  )
}
