import type { DetectedIssue, IssueInteractionBreakdown, ReviewerNote } from '@/types/csv'
import { ALL_ISSUES, ISSUE_BY_ID, type IssueDef } from '@/lib/issues'

export type WeekIssueSignal = {
  /** Unique interactions (if issueInteractionBreakdown) or summed detection rows (legacy) */
  callCount: number
  /** Section column(s) from import or label for interaction-based counts */
  section: string
  /** Representative matched detection title (legacy) */
  matchedTitle: string
  /** Present when counts come from per-interaction breakdown */
  interactionIds?: string[]
}

const MATCH_THRESHOLD = 0.55
const MAX_ISSUES_PER_FINDING = 8

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchScore(detectedNorm: string, issue: IssueDef): number {
  const t = normalize(issue.title)
  const d = normalize(issue.description)
  if (!detectedNorm || detectedNorm.length < 4) return 0

  if (detectedNorm === t) return 1
  if (t.length >= 10 && detectedNorm.includes(t)) return 0.95
  if (detectedNorm.length >= 10 && t.includes(detectedNorm)) return 0.9

  const wordsDet = new Set(detectedNorm.split(/\W+/).filter((w) => w.length >= 4))
  const wordsTitle = new Set(t.split(/\W+/).filter((w) => w.length >= 4))
  if (wordsDet.size === 0) return 0
  let inter = 0
  for (const w of wordsDet) if (wordsTitle.has(w)) inter++
  const union = wordsDet.size + wordsTitle.size - inter
  const jaccard = union > 0 ? inter / union : 0
  let score = jaccard * 0.88

  if (inter >= 2) score = Math.max(score, 0.65)
  if (inter === 1 && wordsDet.size <= 3) score = Math.max(score, 0.55)

  let descHits = 0
  for (const w of wordsDet) if (d.includes(w)) descHits++
  if (descHits >= 3) score = Math.max(score, 0.58)

  return score
}

/**
 * All catalog issues a finding text matches at or above threshold (sorted by score desc).
 * One reviewed call can therefore contribute to several issues.
 */
export function allCatalogIssueIdsForFinding(text: string): string[] {
  const dn = normalize(text.slice(0, 500))
  if (dn.length < 4) return []
  const scored: { id: string; score: number }[] = []
  for (const issue of ALL_ISSUES) {
    const s = matchScore(dn, issue)
    if (s >= MATCH_THRESHOLD) scored.push({ id: issue.id, score: s })
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return scored.slice(0, MAX_ISSUES_PER_FINDING).map((x) => x.id)
}

/**
 * Pick the single best catalog issue for one aggregated CSV detection row (legacy).
 */
export function bestCatalogIssueIdForDetection(detected: DetectedIssue): string | null {
  const ids = allCatalogIssueIdsForFinding(detected.title)
  return ids[0] ?? null
}

/**
 * Merge aggregated detection rows onto catalog issue ids (legacy snapshots).
 */
export function buildWeekIssueSignalMapFromDetectedIssues(
  detectedIssues: DetectedIssue[]
): Map<string, WeekIssueSignal> {
  const map = new Map<string, WeekIssueSignal>()
  for (const det of detectedIssues) {
    const issueId = bestCatalogIssueIdForDetection(det)
    if (!issueId) continue
    const prev = map.get(issueId)
    if (prev) {
      prev.callCount += det.count
      if (!prev.section.split(',').includes(det.section)) {
        prev.section = [prev.section, det.section].filter(Boolean).join(', ')
      }
      if (det.title.length < prev.matchedTitle.length) prev.matchedTitle = det.title
    } else {
      map.set(issueId, {
        callCount: det.count,
        section: det.section,
        matchedTitle: det.title,
      })
    }
  }
  return map
}

function parseIssueInteractionBreakdownFromStatsJson(
  statsJson: unknown
): IssueInteractionBreakdown[] | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).issueInteractionBreakdown
  if (!Array.isArray(raw)) return null
  const out: IssueInteractionBreakdown[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const issueId = typeof o.issueId === 'string' ? o.issueId : ''
    const ids = o.interactionIds
    if (!issueId || !ISSUE_BY_ID[issueId]) continue
    if (!Array.isArray(ids)) continue
    const interactionIds = [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()))]
    if (interactionIds.length === 0) continue
    out.push({ issueId, interactionIds })
  }
  return out.length ? out : null
}

/**
 * Prefer `stats_json.issueInteractionBreakdown` (per-call, multi-issue aware); else legacy detectedIssues.
 */
export function buildWeekIssueSignalMapFromStatsJson(statsJson: unknown): Map<string, WeekIssueSignal> {
  const breakdown = parseIssueInteractionBreakdownFromStatsJson(statsJson)
  if (breakdown && breakdown.length > 0) {
    const map = new Map<string, WeekIssueSignal>()
    for (const { issueId, interactionIds } of breakdown) {
      map.set(issueId, {
        callCount: interactionIds.length,
        section: 'Per-interaction linkage',
        matchedTitle: 'Interaction IDs',
        interactionIds,
      })
    }
    return map
  }
  return buildWeekIssueSignalMapFromDetectedIssues(parseDetectedIssuesFromStatsJson(statsJson))
}

export function buildWeekIssueSignalMap(detectedIssues: DetectedIssue[]): Map<string, WeekIssueSignal> {
  return buildWeekIssueSignalMapFromDetectedIssues(detectedIssues)
}

export function parseDetectedIssuesFromStatsJson(statsJson: unknown): DetectedIssue[] {
  if (!statsJson || typeof statsJson !== 'object') return []
  const raw = (statsJson as Record<string, unknown>).detectedIssues
  if (!Array.isArray(raw)) return []
  const out: DetectedIssue[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title : ''
    const count = typeof o.count === 'number' && o.count >= 0 ? o.count : Number(o.count) || 0
    const priority = typeof o.priority === 'string' ? o.priority : 'p2'
    const section = typeof o.section === 'string' ? o.section : ''
    if (!title.trim() && count === 0) continue
    out.push({ title: title || 'Unknown', count, priority, section })
  }
  return out
}

export function parseReviewerNotesFromStatsJson(statsJson: unknown): ReviewerNote[] {
  if (!statsJson || typeof statsJson !== 'object') return []
  const raw = (statsJson as Record<string, unknown>).reviewerNotes
  if (!Array.isArray(raw)) return []
  const out: ReviewerNote[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const ref = typeof o.ref === 'string' ? o.ref : ''
    const section = typeof o.section === 'string' ? o.section : ''
    const question = typeof o.question === 'string' ? o.question : ''
    const answer = typeof o.answer === 'string' ? o.answer : ''
    const comment = typeof o.comment === 'string' ? o.comment : ''
    const questionPct =
      typeof o.questionPct === 'number' && Number.isFinite(o.questionPct)
        ? o.questionPct
        : Number(o.questionPct) || 0
    if (!comment.trim()) continue
    out.push({ ref, section, question, answer, comment, questionPct })
  }
  return out
}

export type SnapshotListRow = {
  id: string
  label: string
  report_date: string
  call_count: number | null
  avg_score: number | null
  low_score_count: number | null
  issues_detected: number | null
  stats_json: unknown
}

export function resolveWeekSelection(
  weekParam: string | string[] | undefined,
  snapshots: SnapshotListRow[]
): { mode: 'catalog' } | { mode: 'week'; snapshot: SnapshotListRow } {
  const w = Array.isArray(weekParam) ? weekParam[0] : weekParam
  if (w === 'catalog') return { mode: 'catalog' }
  if (!snapshots.length) return { mode: 'catalog' }
  if (!w || w === 'latest') return { mode: 'week', snapshot: snapshots[0] }
  const found = snapshots.find((s) => s.id === w)
  if (found) return { mode: 'week', snapshot: found }
  return { mode: 'week', snapshot: snapshots[0] }
}
