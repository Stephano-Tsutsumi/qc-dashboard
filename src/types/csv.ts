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
}
