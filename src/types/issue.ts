export type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'blocked'

export type Priority = 'p0' | 'p1' | 'p2' | 'p3'

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
