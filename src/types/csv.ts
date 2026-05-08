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

export interface ParsedReport {
  callCount: number
  lowScoreCount: number
  avgScore: number
  detectedIssues: DetectedIssue[]
  sectionStats: Record<string, { zero: number; total: number }>
  dates: string[]
  /**
   * Per catalog issue, which reviewed interactions hit it.
   * Same interaction ID can appear under multiple issues when one call maps to several findings.
   */
  issueInteractionBreakdown: IssueInteractionBreakdown[]
}
