export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      issues: {
        Row: {
          id: string
          priority: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: {
          id: string
          priority: string
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          priority?: string
          title?: string
          description?: string | null
          created_at?: string
        }
      }
      issue_states: {
        Row: {
          issue_id: string
          status: string
          jira_ticket: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          issue_id: string
          status?: string
          jira_ticket?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          issue_id?: string
          status?: string
          jira_ticket?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
      comments: {
        Row: {
          id: string
          issue_id: string
          user_id: string | null
          user_name: string
          user_initials: string
          user_color: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          user_id?: string | null
          user_name: string
          user_initials: string
          user_color?: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          user_id?: string | null
          user_name?: string
          user_initials?: string
          user_color?: string
          body?: string
          created_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          issue_id: string
          user_id: string | null
          user_name: string
          type: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          user_id?: string | null
          user_name: string
          type: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          user_id?: string | null
          user_name?: string
          type?: string
          description?: string
          created_at?: string
        }
      }
      weekly_snapshots: {
        Row: {
          id: string
          label: string
          report_date: string
          call_count: number | null
          low_score_count: number | null
          avg_score: number | null
          issues_detected: number | null
          ai_summary: string | null
          ai_recommendations: string | null
          stats_json: Json
          csv_filename: string | null
          imported_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          report_date: string
          call_count?: number | null
          low_score_count?: number | null
          avg_score?: number | null
          issues_detected?: number | null
          ai_summary?: string | null
          ai_recommendations?: string | null
          stats_json?: Json
          csv_filename?: string | null
          imported_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          report_date?: string
          call_count?: number | null
          low_score_count?: number | null
          avg_score?: number | null
          issues_detected?: number | null
          ai_summary?: string | null
          ai_recommendations?: string | null
          stats_json?: Json
          csv_filename?: string | null
          imported_by?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
