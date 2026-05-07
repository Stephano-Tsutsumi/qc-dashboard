import useSWR from 'swr'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useComments(issueId: string) {
  const { data, error, mutate } = useSWR(
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

  return { comments: data?.comments ?? [], isLoading: !data && !error, error }
}
