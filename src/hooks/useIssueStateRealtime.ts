'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { IssueStatus } from '@/types/issue'
import { normalizeIssueStatus } from '@/types/issue'

export type IssueStateSnapshot = {
  status: IssueStatus
  jira_ticket: string | null
}

/**
 * Subscribes to INSERT/UPDATE on `issue_states` for one issue (Supabase Realtime).
 * Use a stable callback via ref so the channel is not recreated every render.
 */
export function useIssueStateRealtime(issueId: string, onRemoteChange: (row: IssueStateSnapshot) => void) {
  const cbRef = useRef(onRemoteChange)
  cbRef.current = onRemoteChange

  useEffect(() => {
    if (!issueId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`issue_state:${issueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issue_states',
          filter: `issue_id=eq.${issueId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new as { status?: unknown; jira_ticket?: string | null } | null
          if (!row || row.status === undefined || row.status === null) return
          cbRef.current({
            status: normalizeIssueStatus(String(row.status)),
            jira_ticket: row.jira_ticket ?? null,
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [issueId])
}
