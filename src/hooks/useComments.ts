import useSWR from 'swr'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { CommentRow } from '@/types/comment'

type CommentsResponse = { comments: CommentRow[] }

async function fetcher(url: string): Promise<CommentsResponse> {
  const r = await fetch(url, { credentials: 'include' })
  if (!r.ok) throw new Error(`Request failed: ${r.status}`)
  return r.json()
}

export function useComments(issueId: string) {
  const { data, error, mutate } = useSWR<CommentsResponse>(
    issueId ? `/api/issues/${issueId}/comments` : null,
    fetcher
  )

  useEffect(() => {
    if (!issueId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`comments:${issueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `issue_id=eq.${issueId}`,
        },
        () => {
          mutate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [issueId, mutate])

  return { comments: data?.comments ?? [], isLoading: !data && !error, error, mutate }
}
