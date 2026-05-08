'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { IssueStatus, Priority } from '@/types/issue'
import { normalizeIssueStatus } from '@/types/issue'
import type { IssueDef } from '@/lib/issues'
import { PRIORITY_IMPACT_LABEL, isPriority } from '@/lib/priority-sections'
import { StatusPill } from '@/components/ui/StatusPill'
import { IssueCollabPanel } from '@/components/report/IssueCollabPanel'
import { cn } from '@/lib/utils'

function priorityBadgeClass(p: string): string {
  const map: Record<string, string> = {
    p0: 'bg-p0-bg text-p0 border-p0-border',
    p1: 'bg-p1-bg text-p1 border-p1-border',
    p2: 'bg-p2-bg text-p2 border-p2-border',
    p3: 'bg-p3-bg text-p3 border-p3-border',
  }
  return map[p] ?? 'bg-surface-2 text-text border-border'
}

function chipRefLabel(ref: string, max = 32) {
  const t = ref.trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export interface IssueCardProps {
  id: string
  priority: Priority | string
  title: string
  description: string
  status: string | null | undefined
  jiraTicket: string | null | undefined
  commentCount: number
  evidence: IssueDef['evidence']
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
      {children}
    </h3>
  )
}

/**
 * Collapsible issue card: header + evidence + collaboration when expanded; footer always visible.
 */
export function IssueCard({
  id,
  priority,
  title,
  description,
  status,
  jiraTicket,
  commentCount,
  evidence,
}: IssueCardProps) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const p = String(priority).toLowerCase()

  const [displayStatus, setDisplayStatus] = useState(() => normalizeIssueStatus(status))
  const [displayJira, setDisplayJira] = useState<string | null>(jiraTicket ?? null)
  const [shownCommentCount, setShownCommentCount] = useState(commentCount)

  useEffect(() => {
    setDisplayStatus(normalizeIssueStatus(status))
  }, [status])

  useEffect(() => {
    setDisplayJira(jiraTicket ?? null)
  }, [jiraTicket])

  useEffect(() => {
    setShownCommentCount(commentCount)
  }, [commentCount])

  const syncCommentCount = useCallback((n: number) => {
    setShownCommentCount(n)
  }, [])

  const refChips = useMemo(() => {
    const refs = evidence.qcNotes.map((n) => n.ref.trim()).filter(Boolean)
    return [...new Set(refs)]
  }, [evidence.qcNotes])

  const impactLabel = isPriority(p) ? PRIORITY_IMPACT_LABEL[p] : 'Impact: —'

  return (
    <article
      id={`issue-${id}`}
      data-issue-id={id}
      className="rounded border border-border bg-surface shadow-sm"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2/60"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`inline-block shrink-0 rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${priorityBadgeClass(p)}`}
        >
          {p}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 id={`issue-${id}-heading`} className="font-semibold leading-snug text-text">
              {title}
            </h2>
            <span
              className={cn(
                'mt-0.5 inline-flex shrink-0 text-text-muted transition-transform duration-200',
                open && 'rotate-180'
              )}
              aria-hidden
            >
              <ChevronIcon />
            </span>
          </div>
          {description ? (
            <p
              className={cn(
                'mt-1 text-sm leading-relaxed text-text-secondary',
                !open && 'line-clamp-2'
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`issue-${id}-heading`}
        hidden={!open}
      >
        {open ? (
          <div className="space-y-6 border-t border-border bg-[var(--surface-2)]/40 px-4 py-5">
            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex max-w-full items-center rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-xs font-medium text-text-secondary"
                title="Severity band for this priority"
              >
                {impactLabel}
              </span>
              {refChips.map((ref) => (
                <span
                  key={ref}
                  title={ref}
                  className="mono inline-flex max-w-full items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-accent"
                >
                  Ref: {chipRefLabel(ref)}
                </span>
              ))}
            </div>
            <div>
              <SectionLabel>QC reviewer notes</SectionLabel>
              <ul className="mt-3 list-none space-y-5 p-0">
                {evidence.qcNotes.map((note, i) => (
                  <li key={`${note.ref}-${i}`}>
                    <code className="mono text-xs font-medium text-accent">{note.ref}</code>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                      {note.comment}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionLabel>Recommended action</SectionLabel>
              <p className="mt-3 text-sm leading-relaxed text-text">{evidence.recommendedAction}</p>
            </div>
            <IssueCollabPanel
              issueId={id}
              status={displayStatus}
              jiraTicket={displayJira}
              onStatusChange={(s: IssueStatus) => setDisplayStatus(s)}
              onJiraChange={(j) => setDisplayJira(j)}
              onCommentsLengthChange={syncCommentCount}
            />
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <StatusPill status={displayStatus} />
        {displayJira ? (
          <span className="mono inline-flex items-center rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-secondary">
            {displayJira}
          </span>
        ) : null}
        {shownCommentCount > 0 ? (
          <span
            className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent/15 px-2 text-xs font-semibold tabular-nums text-accent"
            title={`${shownCommentCount} comment${shownCommentCount === 1 ? '' : 's'}`}
          >
            {shownCommentCount}
          </span>
        ) : null}
      </footer>
    </article>
  )
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 8l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
