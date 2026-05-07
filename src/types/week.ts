export interface WeekSnapshotRow {
  id: string
  label: string
  report_date: string
  call_count: number | null
  low_score_count: number | null
  avg_score: number | null
  issues_detected: number | null
  ai_summary: string | null
  ai_recommendations: string | null
  stats_json: Record<string, unknown>
  csv_filename: string | null
  imported_by: string | null
  created_at: string
}
