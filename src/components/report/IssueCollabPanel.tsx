'use client'

import { useCallback, useEffect, useState } from 'react'
import type { IssueStatus } from '@/types/issue'
import { ISSUE_STATUS_OPTIONS, normalizeIssueStatus } from '@/types/issue'
import { useComments } from '@/hooks/useComments'
import type { CommentRow } from '@/types/comment'
import { cn, formatRelativeTime } from '@/lib/utils'

export interface IssueCollabPanelProps {
  issueId: string
  status: string | null | undefined
  jiraTicket: string | null | undefined
  onStatusChange: (s: IssueStatus) => void
  onJiraChange: (j: string | null) => void
  onCommentsLengthChange?: (n: number) => void
}

type PatchIssuePayload = { status?: IssueStatus; jira_ticket?: string | null }

export function IssueCollabPanel({
  issueId,
  status,
  jiraTicket,
  onStatusChange,
  onJiraChange,
  onCommentsLengthChange,
}: IssueCollabPanelProps) {
  const { comments, isLoading, mutate } = useComments(issueId)
  const [statusSaving, setStatusSaving] = useState(false)
  const [jiraDraft, setJiraDraft] = useState(() => jiraTicket ?? '')
  const [jiraSaving, setJiraSaving] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  useEffect(() => {
    setJiraDraft(jiraTicket ?? '')
  }, [jiraTicket])

  useEffect(() => {
    onCommentsLengthChange?.(comments.length)
  }, [comments.length, onCommentsLengthChange])

  const patchIssue = useCallback(
    async (payload: PatchIssuePayload) => {
      const r = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('Save failed')
    },
    [issueId]
  )

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as IssueStatus
    setStatusSaving(true)
    setBannerError(null)
    try {
      await patchIssue({ status: next })
      onStatusChange(next)
    } catch {
      setBannerError('Could not update status.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleJiraSubmit(e: React.FormEvent) {
    e.preventDefault()
    setJiraSaving(true)
    setBannerError(null)
    const value = jiraDraft.trim() || null
    try {
      await patchIssue({ jira_ticket: value })
      onJiraChange(value)
    } catch {
      setBannerError('Could not save Jira key.')
    } finally {
      setJiraSaving(false)
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault()
    const text = postBody.trim()
    if (!text) return
    setPosting(true)
    setBannerError(null)
    try {
      const r = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!r.ok) throw new Error('post failed')
      setPostBody('')
      await mutate()
    } catch {
      setBannerError('Could not post comment.')
    } finally {
      setPosting(false)
    }
  }

  const normalized = normalizeIssueStatus(status)

  return (
    <div className="space-y-5 border-t border-border pt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        Collaboration
      </h3>

      {bannerError ? (
        <p className="rounded border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-900">
          {bannerError}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1.5 block text-xs font-medium text-text-secondary">Status</span>
          <select
            className={cn(
              'w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
              statusSaving && 'opacity-60'
            )}
            value={normalized}
            onChange={handleStatusChange}
            disabled={statusSaving}
          >
            {ISSUE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={handleJiraSubmit}
          className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-text-secondary">Jira</span>
            <input
              type="text"
              value={jiraDraft}
              onChange={(e) => setJiraDraft(e.target.value)}
              placeholder="e.g. PROJ-123"
              className="mono w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={jiraSaving}
            className="shrink-0 rounded border border-border-strong bg-surface-2 px-4 py-2 text-xs font-semibold text-text hover:bg-surface-2 disabled:opacity-50"
          >
            {jiraSaving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      <div>
        <h4 className="text-xs font-medium text-text-secondary">Comments</h4>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No comments yet.</p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
            {comments.map((c) => (
              <CommentRowView key={c.id} comment={c} />
            ))}
          </ul>
        )}

        <form onSubmit={handlePostComment} className="mt-4 space-y-2">
          <label className="block">
            <span className="sr-only">Add a comment</span>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              rows={3}
              placeholder="Write a comment…"
              className="w-full resize-y rounded border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !postBody.trim()}
              className="rounded bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
            >
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CommentRowView({ comment: c }: { comment: CommentRow }) {
  return (
    <li className="flex gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: c.user_color || 'var(--accent)' }}
        title={c.user_name}
      >
        {c.user_initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-sm font-medium text-text">{c.user_name}</span>
          <time className="text-xs tabular-nums text-text-muted" dateTime={c.created_at}>
            {formatRelativeTime(c.created_at)}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
          {c.body}
        </p>
      </div>
    </li>
  )
}
