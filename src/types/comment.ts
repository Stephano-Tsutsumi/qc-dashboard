export interface CommentRow {
  id: string
  issue_id: string
  user_id: string | null
  user_name: string
  user_initials: string
  user_color: string
  body: string
  created_at: string
}
