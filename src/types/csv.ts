export interface IssueInteractionBreakdown {
  issueId: string
  /** Distinct interaction / call IDs tied to this catalog issue for the import */
  interactionIds: string[]
}

export interface DetectedIssue {
  priority: string
  title: string
  count: number
  section: string
}

/** One row-level reviewer observation from Answer Comment (v4 QC export). */
export interface ReviewerNote {
  ref: string
  section: string
  question: string
  answer: string
  comment: string
  questionPct: number
}

/** One deduplicated call from Reference + Score Percentage (first row wins). */
export interface CallSummary {
  ref: string
  score: number
  date: string
  duration: string
  range: string
}

export type SnapshotScoreBucketKey = 'lte50' | 'lte60' | 'lte70' | 'lte75' | 'pass'

export interface SnapshotScoreBucket {
  count: number
  refs: string[]
}

export interface ParsedReport {
  callCount: number
  lowScoreCount: number
  avgScore: number
  detectedIssues: DetectedIssue[]
  sectionStats: Record<string, { zero: number; total: number }>
  dates: string[]
  issueInteractionBreakdown: IssueInteractionBreakdown[]
  /** Present for v4 Reference-based exports */
  reviewerNotes: ReviewerNote[]
  calls: CallSummary[]
  /** Set when ingest distinguishes flat vs multi-row CSV */
  format?: 'v4-multirow' | 'v5-flat'
  /** Calls scoring ≥76% overall */
  passRate?: number
  /** Histogram by overall call score */
  scoreDistribution?: Record<SnapshotScoreBucketKey, SnapshotScoreBucket>
  /** Prompt-category averages for charts */
  sectionStatsChart?: Array<{ section: string; scorePercent: number }>
  /** v5-only structured reviewer snippets keyed by catalog issue id */
  reviewerNotesByIssueId?: Record<string, Array<{ label: string; text: string }>>
}
