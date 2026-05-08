export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'blocked'

export type Priority = 'p0' | 'p1' | 'p2' | 'p3'

export function normalizeIssueStatus(raw: string | null | undefined): IssueStatus {
  if (raw === 'in-progress' || raw === 'resolved' || raw === 'blocked') return raw
  return 'open'
}

export const ISSUE_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'blocked', label: 'Blocked' },
]

export interface IssueRow {
  id: string
  priority: Priority
  title: string
  description: string
  status: IssueStatus
  jira_ticket: string | null
  updated_at: string
  comment_count: number
}
