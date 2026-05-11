'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { IssueStatus, Priority } from '@/types/issue'
import { normalizeIssueStatus } from '@/types/issue'
import type { IssueDef } from '@/lib/issues'
import { PRIORITY_IMPACT_LABEL, isPriority } from '@/lib/priority-sections'
import { StatusPill } from '@/components/ui/StatusPill'
import { IssueCollabPanel } from '@/components/report/IssueCollabPanel'
import { useIssueStateRealtime } from '@/hooks/useIssueStateRealtime'
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

type QcNote = IssueDef['evidence']['qcNotes'][number]

/** Interaction ID + category line (matches CSV layout); legacy SPECIAL uses "ID — category" inside ref. */
function qcNoteHeader(note: QcNote): { id: string; category: string } | null {
  const section = note.section?.trim()
  const rawRef = note.ref.trim()
  if (section && rawRef && rawRef !== 'QC') {
    return { id: rawRef, category: section }
  }
  if (rawRef.includes(' — ')) {
    const i = rawRef.indexOf(' — ')
    const id = rawRef.slice(0, i).trim()
    const category = rawRef.slice(i + 3).trim()
    if (id) return { id, category: category || 'Reviewer note' }
  }
  if (rawRef && rawRef !== 'QC') {
    return { id: rawRef, category: '' }
  }
  return null
}

function CopyIcon(props: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function InteractionIdsPanel({ ids }: { ids: string[] }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const list = useMemo(() => [...new Set(ids.map((s) => s.trim()).filter(Boolean))], [ids])

  const flash = useCallback((msg: string) => {
    setFeedback(msg)
    window.setTimeout(() => setFeedback(null), 2000)
  }, [])

  const copyText = useCallback(
    async (text: string, ok: string) => {
      try {
        await navigator.clipboard.writeText(text)
        flash(ok)
      } catch {
        flash('Copy blocked — select text in the box below')
      }
    },
    [flash]
  )

  if (!list.length) return null

  const comma = list.join(', ')
  const lines = list.join('\n')

  return (
    <div>
      <SectionLabel>Interaction IDs (this import)</SectionLabel>
      <p className="mt-1 text-xs text-text-muted">
        Validate in your QA platform or paste into a ticket. Each pill copies one ID.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2/80"
          onClick={() => copyText(comma, `Copied ${list.length} ID${list.length === 1 ? '' : 's'} (comma-separated)`)}
        >
          <span className="inline-flex items-center gap-1">
            <CopyIcon /> Copy all (comma-separated)
          </span>
        </button>
        <button
          type="button"
          className="rounded-sm border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
          onClick={() => copyText(lines, `Copied ${list.length} ID${list.length === 1 ? '' : 's'} (one per line)`)}
        >
          <span className="inline-flex items-center gap-1">
            <CopyIcon /> Copy all (line-separated)
          </span>
        </button>
      </div>
      {feedback ? <p className="mt-2 text-xs font-medium text-accent">{feedback}</p> : null}
      <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {list.map((interactionId) => (
          <button
            key={interactionId}
            type="button"
            title={`Copy ${interactionId}`}
            onClick={() => copyText(interactionId, `Copied ${interactionId}`)}
            className="mono inline-flex max-w-full shrink-0 items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-accent hover:border-accent/40 hover:bg-accent/5"
          >
            {interactionId}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="sr-only">All interaction IDs for manual selection</span>
        <textarea
          readOnly
          value={lines}
          rows={Math.min(10, Math.max(3, list.length))}
          className="mono mt-1 w-full resize-y rounded-sm border border-border bg-surface px-2 py-2 text-[11px] leading-snug text-text-secondary focus:border-accent focus:outline-none"
          spellCheck={false}
        />
      </label>
    </div>
  )
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
  /** Aggregated CSV detection count when a weekly snapshot is selected */
  weekImportSignal?: { callCount: number; section: string; interactionIds?: string[] } | null
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
  weekImportSignal,
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

  const applyRemoteIssueState = useCallback(
    (row: { status: IssueStatus; jira_ticket: string | null }) => {
      setDisplayStatus(row.status)
      setDisplayJira(row.jira_ticket)
    },
    []
  )

  useIssueStateRealtime(id, applyRemoteIssueState)

  const refChips = useMemo(() => {
    const refs = evidence.qcNotes.map((n) => n.ref.trim()).filter(Boolean)
    return [...new Set(refs)]
  }, [evidence.qcNotes])

  const showRefChipRow = useMemo(() => {
    if (refChips.length === 0) return false
    if (refChips.length === 1 && refChips[0] === 'QC') return false
    return !evidence.qcNotes.some((n) => qcNoteHeader(n) != null)
  }, [evidence.qcNotes, refChips])

  const importLineTitle = useMemo(() => {
    const ids = weekImportSignal?.interactionIds
    if (ids?.length) {
      return `Expand this card to view and copy all ${ids.length} interaction ID${ids.length === 1 ? '' : 's'}`
    }
    return weekImportSignal?.section ? `Columns: ${weekImportSignal.section}` : undefined
  }, [weekImportSignal?.interactionIds, weekImportSignal?.section])

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
          {weekImportSignal ? (
            <p
              className="mt-2 text-xs font-medium text-accent"
              title={importLineTitle}
            >
              This import · {weekImportSignal.callCount}{' '}
              {weekImportSignal.interactionIds?.length
                ? `interaction${weekImportSignal.callCount === 1 ? '' : 's'}`
                : `call${weekImportSignal.callCount === 1 ? '' : 's'} flagged`}
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
              {showRefChipRow
                ? refChips.map((ref) => (
                    <span
                      key={ref}
                      title={ref}
                      className="mono inline-flex max-w-full items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-accent"
                    >
                      Ref: {chipRefLabel(ref)}
                    </span>
                  ))
                : null}
            </div>
            {weekImportSignal?.interactionIds?.length ? (
              <InteractionIdsPanel ids={weekImportSignal.interactionIds} />
            ) : null}
            <div>
              <SectionLabel>QC reviewer notes</SectionLabel>
              <ul className="mt-3 list-none space-y-3 p-0">
                {evidence.qcNotes.map((note, i) => {
                  const header = qcNoteHeader(note)
                  return (
                    <li key={`${note.ref}-${i}`}>
                      <div
                        className="rounded border border-border bg-surface px-3 py-3 shadow-sm"
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        {header ? (
                          <div className="text-sm leading-snug">
                            <span className="mono font-semibold text-accent">{header.id}</span>
                            {header.category ? (
                              <>
                                <span className="text-text-muted"> — </span>
                                <span className="font-medium text-text-secondary">
                                  {header.category}
                                </span>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        <p
                          className={cn(
                            'text-sm leading-relaxed text-text-secondary',
                            header ? 'mt-2' : ''
                          )}
                        >
                          {note.comment}
                        </p>
                      </div>
                    </li>
                  )
                })}
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
