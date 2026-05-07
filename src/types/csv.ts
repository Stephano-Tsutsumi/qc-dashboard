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
}
