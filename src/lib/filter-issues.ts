import type { SnapshotScoreBucketKey } from '@/types/csv'

/** Filters apply AND across axes (priority, channel, score bucket). */
export type ReportFilterState = {
  priority: 'all' | 'p0' | 'p1' | 'p2' | 'p3'
  channel: 'all' | 'voice' | 'chat'
  score: 'all' | SnapshotScoreBucketKey
}

export type FilterableIssueRow = {
  id: string
  priority: string
  channel?: 'voice' | 'chat' | 'both'
  scoreRanges: SnapshotScoreBucketKey[]
}

export function filterIssueRows<T extends FilterableIssueRow>(
  issues: T[],
  filters: ReportFilterState
): T[] {
  return issues.filter((issue) => {
    const p = String(issue.priority).toLowerCase()
    const priorityMatch = filters.priority === 'all' || p === filters.priority

    const ch = issue.channel ?? 'both'
    const channelMatch =
      filters.channel === 'all' || ch === 'both' || ch === filters.channel

    const scoreMatch =
      filters.score === 'all' ||
      (issue.scoreRanges.length > 0 && issue.scoreRanges.includes(filters.score))

    return priorityMatch && channelMatch && scoreMatch
  })
}
