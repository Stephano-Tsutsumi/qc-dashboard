import Papa from 'papaparse'
import type {
  ParsedReport,
  DetectedIssue,
  IssueInteractionBreakdown,
  ReviewerNote,
  CallSummary,
} from '@/types/csv'
import { ALL_ISSUES } from '@/lib/issues'
import { filterNotesForIssue } from '@/lib/issueNoteRules'
import { allCatalogIssueIdsForFinding } from '@/lib/snapshot-stats'

/** Parses numeric score from a cell (0–100 or 0–1). */
function parseScore(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = parseFloat(String(raw).replace(/[%\s]/g, ''))
  if (Number.isNaN(n)) return null
  return n <= 1 && n >= 0 ? n * 100 : n
}

function isZeroLike(raw: string | undefined): boolean {
  if (raw == null || raw === '') return false
  const s = String(raw).trim().toLowerCase()
  if (s === '0' || s === '0.0' || s === 'fail' || s === 'no' || s === 'n') return true
  const n = parseFloat(s)
  return !Number.isNaN(n) && n === 0
}

function trimRowKeys(row: Record<string, string>): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    o[k.trim()] = v == null ? '' : String(v)
  }
  return o
}

function isV4QcExport(fieldNames: string[]): boolean {
  const s = new Set(fieldNames.map((f) => f.trim()))
  return s.has('Reference') && s.has('Score Percentage') && s.has('Answer Comment')
}

/**
 * AVA QC scorecard export: many rows per call; dedupe by Reference for call-level stats.
 */
function parseV4QC(rows: Record<string, string>[]): ParsedReport {
  const callMap = new Map<
    string,
    { score: number; date: string; duration: string; range: string }
  >()

  for (const row of rows) {
    const ref = row['Reference']?.trim()
    if (!ref || callMap.has(ref)) continue

    let score = parseFloat(row['Score Percentage'] ?? '') || 0
    if (score > 0 && score <= 1.0001) score *= 100

    const eventDate = row['Event Date'] ?? ''
    callMap.set(ref, {
      score,
      date: eventDate.split(/\s+/)[0]?.trim() ?? '',
      duration: row['Event Duration'] ?? '',
      range: row['Range'] ?? '',
    })
  }

  const callCount = callMap.size
  const scores = [...callMap.values()].map((c) => c.score)
  const lowScoreCount = scores.filter((s) => s <= 60).length
  const avgScore = callCount ? scores.reduce((a, b) => a + b, 0) / callCount : 0

  const reviewerNotes: ReviewerNote[] = []
  for (const row of rows) {
    const comment = row['Answer Comment']?.trim()
    if (!comment) continue
    reviewerNotes.push({
      ref: row['Reference']?.trim() ?? '',
      section: row['Section Text']?.trim() ?? '',
      question: row['Question Text']?.trim() ?? '',
      answer: row['Answer']?.trim() ?? '',
      comment,
      questionPct: parseFloat(row['Question Percentage'] ?? '') || 0,
    })
  }

  const sectionStats: Record<string, { zero: number; total: number }> = {}
  for (const row of rows) {
    const section = row['Section Text']?.trim()
    if (!section) continue
    if (!sectionStats[section]) sectionStats[section] = { zero: 0, total: 0 }
    sectionStats[section].total++
    if (parseFloat(row['Question Percentage'] ?? '') === 0) {
      sectionStats[section].zero++
    }
  }

  const calls: CallSummary[] = [...callMap.entries()].map(([ref, data]) => ({
    ref,
    ...data,
  }))

  const dates = [...new Set([...callMap.values()].map((c) => c.date).filter(Boolean))]

  const issueInteractionBreakdown: IssueInteractionBreakdown[] = []
  for (const issue of ALL_ISSUES) {
    const matched = filterNotesForIssue(issue.id, reviewerNotes)
    const interactionIds = [...new Set(matched.map((n) => n.ref).filter(Boolean))]
    if (interactionIds.length)
      issueInteractionBreakdown.push({ issueId: issue.id, interactionIds })
  }
  issueInteractionBreakdown.sort((a, b) => b.interactionIds.length - a.interactionIds.length)

  const detectedIssues = buildDetectedIssuesFromReviewerNotes(reviewerNotes)
  if (detectedIssues.length === 0 && lowScoreCount > 0) {
    detectedIssues.push({
      priority: 'p1',
      title: 'Low-scoring calls in ingest (≤60%)',
      count: lowScoreCount,
      section: 'Aggregate',
    })
  }

  return {
    callCount,
    lowScoreCount,
    avgScore,
    detectedIssues,
    sectionStats,
    dates,
    issueInteractionBreakdown,
    reviewerNotes,
    calls,
  }
}

function buildDetectedIssuesFromReviewerNotes(notes: ReviewerNote[]): DetectedIssue[] {
  const counts = new Map<string, { count: number; section: string }>()
  for (const n of notes) {
    const key = n.comment.slice(0, 120)
    const prev = counts.get(key)
    if (prev) prev.count++
    else counts.set(key, { count: 1, section: n.section || 'Review' })
  }
  return [...counts.entries()]
    .map(([title, { count, section }]) => ({
      priority: 'p2',
      title,
      count,
      section,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
}

/** Heuristic parser for non–v4-shaped CSVs. */
function parseLegacyQC(
  rows: Record<string, string>[],
  fields: string[]
): ParsedReport {
  const scoreKey =
    fields.find((f) => /overall|total|final|score|percent/i.test(f)) ?? fields[0]

  const scores: number[] = []
  for (const row of rows) {
    const sc = parseScore(scoreKey ? row[scoreKey.trim()] : undefined)
    if (sc != null) scores.push(sc)
  }

  const callCount = rows.length
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const lowScoreCount = scores.filter((s) => s <= 60).length

  const sectionStats: Record<string, { zero: number; total: number }> = {}
  for (const f of fields) {
    const fk = f.trim()
    if (fk === scoreKey?.trim()) continue
    if (!/[a-z]/i.test(fk)) continue
    let zero = 0
    let total = 0
    for (const row of rows) {
      const v = row[fk]
      if (v == null || v === '') continue
      total++
      if (isZeroLike(v) || parseScore(v) === 0) zero++
    }
    if (total > 0) sectionStats[fk] = { zero, total }
  }

  const dates: string[] = []
  const dateKey = fields.find((f) => /date|week|report/i.test(f))
  if (dateKey) {
    const dk = dateKey.trim()
    for (const row of rows) {
      const d = row[dk]?.trim()
      if (d && !dates.includes(d)) dates.push(d)
    }
  }

  const commentKeys = fields.filter((f) => /comment|note|qc|failure|issue|finding/i.test(f))
  const interactionKey = fields.find((f) =>
    /interaction|call.?id|session.?id|conversation.?id|transcript.?id|^reference$/i.test(
      f.replace(/\s+/g, ' ').trim()
    )
  )

  const issueToInteractions = new Map<string, Set<string>>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rawInteraction = interactionKey ? row[interactionKey.trim()]?.trim() : ''
    const interactionId = rawInteraction || `row:${i}`

    const issueHitsThisRow = new Set<string>()
    for (const f of commentKeys) {
      const text = row[f.trim()]?.trim()
      if (!text) continue
      for (const issueId of allCatalogIssueIdsForFinding(text)) {
        issueHitsThisRow.add(issueId)
      }
    }

    for (const issueId of issueHitsThisRow) {
      if (!issueToInteractions.has(issueId)) issueToInteractions.set(issueId, new Set())
      issueToInteractions.get(issueId)!.add(interactionId)
    }
  }

  const issueInteractionBreakdown: IssueInteractionBreakdown[] = [...issueToInteractions.entries()]
    .map(([issueId, set]) => ({ issueId, interactionIds: [...set] }))
    .sort((a, b) => b.interactionIds.length - a.interactionIds.length)

  const detectedIssues: DetectedIssue[] = []
  for (const f of commentKeys) {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const text = row[f.trim()]?.trim()
      if (!text) continue
      const key = text.slice(0, 120)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [title, count] of counts) {
      if (count < 1) continue
      detectedIssues.push({
        priority: 'p2',
        title,
        count,
        section: f,
      })
    }
  }

  if (detectedIssues.length === 0 && lowScoreCount > 0) {
    detectedIssues.push({
      priority: 'p1',
      title: 'Low-scoring calls in ingest (≤60%)',
      count: lowScoreCount,
      section: 'Aggregate',
    })
  }

  return {
    callCount,
    lowScoreCount,
    avgScore,
    detectedIssues: detectedIssues.slice(0, 50),
    sectionStats,
    dates,
    issueInteractionBreakdown,
    reviewerNotes: [],
    calls: [],
  }
}

export function parseQCCSV(csvText: string): ParsedReport {
  const result = Papa.parse<Record<string, string | undefined>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  const fields = (result.meta.fields ?? []).filter(Boolean) as string[]
  const rowsRaw = result.data.filter((r) =>
    Object.keys(r).some((k) => String(r[k] ?? '').trim())
  )

  const rows = rowsRaw.map((r) => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(r)) {
      o[k] = v == null ? '' : String(v)
    }
    return trimRowKeys(o)
  })

  if (rows.length && isV4QcExport(fields)) {
    return parseV4QC(rows)
  }

  return parseLegacyQC(rows, fields)
}
