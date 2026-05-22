import Papa from 'papaparse'
import type {
  ParsedReport,
  DetectedIssue,
  IssueInteractionBreakdown,
  ReviewerNote,
  CallSummary,
  SnapshotScoreBucket,
  SnapshotScoreBucketKey,
  DailyTrendPoint,
} from '@/types/csv'
import {
  QUESTION_COLUMNS,
  detectCSVFormat,
  GENERAL_COMMENT_COL,
  getQuestionLabel,
  parseAnalyticsQuestion,
  parseGeneralCommentsOnly,
  parseQuestionScore,
  type QuestionScore,
} from '@/lib/csv/scorecard'
import {
  ISSUE_SCORECARD_QUESTIONS,
  noteSourceQuestionIdsForIssue,
  SCORECARD_QUESTION_TO_ISSUE_IDS,
} from '@/lib/csv/scorecard-issues'
import { ALL_ISSUES, ISSUE_BY_ID } from '@/lib/issues'
import { filterNotesForIssue } from '@/lib/issueNoteRules'
import { allCatalogIssueIdsForFinding } from '@/lib/snapshot-stats'

export { detectCSVFormat } from '@/lib/csv/scorecard'

function assignOverallScoreBucket(score: number): SnapshotScoreBucketKey {
  if (score <= 50) return 'lte50'
  if (score <= 60) return 'lte60'
  if (score <= 70) return 'lte70'
  if (score <= 75) return 'lte75'
  return 'pass'
}

function emptyScoreBuckets(): Record<SnapshotScoreBucketKey, SnapshotScoreBucket> {
  return {
    lte50: { count: 0, refs: [] },
    lte60: { count: 0, refs: [] },
    lte70: { count: 0, refs: [] },
    lte75: { count: 0, refs: [] },
    pass: { count: 0, refs: [] },
  }
}

function buildScoreDistributionFromCalls(calls: CallSummary[]): Record<
  SnapshotScoreBucketKey,
  SnapshotScoreBucket
> {
  const dist = emptyScoreBuckets()
  for (const c of calls) {
    const key = assignOverallScoreBucket(c.score)
    dist[key].count++
    dist[key].refs.push(c.ref)
  }
  return dist
}

/**
 * Strip trailing `.0` from float-encoded integer refs produced by Excel CSV exports.
 * Python equivalent: str(int(x)) if pd.notna(x) else ''
 */
function normalizeRef(raw: string | undefined): string {
  const s = (raw ?? '').trim()
  return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, '') : s
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildDailyTrend(calls: CallSummary[]): DailyTrendPoint[] {
  const byDate = new Map<string, { voice: number[]; chat: number[] }>()
  for (const c of calls) {
    if (!c.date) continue
    if (!byDate.has(c.date)) byDate.set(c.date, { voice: [], chat: [] })
    const bucket = byDate.get(c.date)!
    if (c.eventType === 'Voice') bucket.voice.push(c.score)
    else if (c.eventType === 'Chat') bucket.chat.push(c.score)
  }
  const dates = [...byDate.keys()].sort()
  return dates.map((d) => {
    const b = byDate.get(d)!
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : null
    return { date: d, voice: avg(b.voice), chat: avg(b.chat) }
  })
}

function parseEventType(raw: string | undefined): 'Voice' | 'Chat' | undefined {
  const s = (raw ?? '').trim()
  if (s === 'Voice') return 'Voice'
  if (s === 'Chat') return 'Chat'
  return undefined
}

type InternalFlatCall = {
  reference: string
  scorePct: number
  questions: Record<string, QuestionScore>
  date: string
  duration: string
  range: string
  eventType?: 'Voice' | 'Chat'
}

function computeSectionZeroTotalFromFlat(
  flatCalls: InternalFlatCall[]
): Record<string, { zero: number; total: number }> {
  const out: Record<string, { zero: number; total: number }> = {}
  for (const call of flatCalls) {
    for (const qDef of QUESTION_COLUMNS) {
      const q = call.questions[qDef.id]
      if (!q) continue
      if (!qDef.isAnalytics && q.isNA) continue
      const sec = qDef.section
      if (!out[sec]) out[sec] = { zero: 0, total: 0 }
      out[sec].total++
      if (q.isFailing) out[sec].zero++
    }
  }
  return out
}

function computeSectionStatsChartFromFlat(
  flatCalls: InternalFlatCall[]
): Array<{ section: string; scorePercent: number }> {
  const sectionMap: Record<string, { sum: number; max: number }> = {}
  for (const call of flatCalls) {
    for (const qDef of QUESTION_COLUMNS) {
      if (qDef.isAnalytics) continue
      const q = call.questions[qDef.id]
      if (!q || q.isNA || q.numericScore === null || q.maxScore === null) continue
      if (!sectionMap[qDef.section]) sectionMap[qDef.section] = { sum: 0, max: 0 }
      sectionMap[qDef.section].sum += q.numericScore
      sectionMap[qDef.section].max += q.maxScore
    }
  }
  return Object.entries(sectionMap).map(([section, { sum, max }]) => ({
    section,
    scorePercent: max > 0 ? Math.round((sum / max) * 10000) / 100 : 0,
  }))
}

function buildIssueRefsFromScorecard(calls: InternalFlatCall[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  const add = (issueId: string, ref: string) => {
    if (!ISSUE_BY_ID[issueId]) return
    if (!m.has(issueId)) m.set(issueId, new Set())
    m.get(issueId)!.add(ref)
  }
  for (const call of calls) {
    const ref = call.reference
    for (const qDef of QUESTION_COLUMNS) {
      const q = call.questions[qDef.id]
      if (!q?.isFailing) continue
      const ids = SCORECARD_QUESTION_TO_ISSUE_IDS[qDef.id]
      if (!ids?.length) continue
      for (const issueId of ids) add(issueId, ref)
    }
  }
  return m
}

function mergeIssueRefsFromNotes(
  reviewerNotes: ReviewerNote[],
  into: Map<string, Set<string>>
): Map<string, Set<string>> {
  for (const issue of ALL_ISSUES) {
    const matched = filterNotesForIssue(issue.id, reviewerNotes)
    const refs = [...new Set(matched.map((n) => n.ref.trim()).filter(Boolean))]
    if (!refs.length) continue
    if (!into.has(issue.id)) into.set(issue.id, new Set())
    const set = into.get(issue.id)!
    for (const r of refs) set.add(r)
  }
  return into
}

function issueBreakdownFromRefMap(refMap: Map<string, Set<string>>): IssueInteractionBreakdown[] {
  const out: IssueInteractionBreakdown[] = []
  for (const [issueId, set] of refMap) {
    const interactionIds = [...set]
    if (interactionIds.length === 0) continue
    out.push({ issueId, interactionIds })
  }
  out.sort((a, b) => b.interactionIds.length - a.interactionIds.length)
  return out
}

function buildReviewerNotesByIssueId(
  flatCalls: InternalFlatCall[]
): Record<string, Array<{ label: string; text: string }>> {
  const out: Record<string, Array<{ label: string; text: string }>> = {}
  const issueIds = Object.keys(ISSUE_SCORECARD_QUESTIONS)
  for (const issueId of issueIds) {
    const sources = noteSourceQuestionIdsForIssue(issueId)
    if (!sources.length) continue
    const bucket: Array<{ label: string; text: string }> = []
    outer: for (const call of flatCalls) {
      const flagged = ISSUE_SCORECARD_QUESTIONS[issueId]?.some(
        (qid) => call.questions[qid]?.isFailing
      )
      if (!flagged) continue
      for (const srcId of sources) {
        const q = call.questions[srcId]
        const text = q?.comment?.trim()
        if (!text) continue
        bucket.push({
          label: `${call.reference} — Q${srcId} ${getQuestionLabel(srcId)}`,
          text,
        })
        if (bucket.length >= 5) break outer
      }
    }
    if (bucket.length) out[issueId] = bucket
  }
  return out
}

/** One row per call — flat scorecard columns. */
function parseV5FlatQC(rows: Record<string, string>[]): ParsedReport {
  const seenRef = new Set<string>()
  const flatCalls: InternalFlatCall[] = []

  for (const row of rows) {
    const reference = normalizeRef(row['Reference'])
    if (!reference || seenRef.has(reference)) continue
    seenRef.add(reference)

    const questions: Record<string, QuestionScore> = {}
    for (const qDef of QUESTION_COLUMNS) {
      const rawValue = row[qDef.col]
      const commentCol = `${qDef.col} Cmt`
      const commentValue = row[commentCol]
      questions[qDef.id] = qDef.isAnalytics
        ? parseAnalyticsQuestion(qDef.id, qDef.label, rawValue, commentValue)
        : parseQuestionScore(qDef.id, qDef.label, rawValue, commentValue)
    }

    const gen = parseGeneralCommentsOnly(row[GENERAL_COMMENT_COL])
    if (gen) questions['7.6'] = gen

    let scorePct = parseFloat(row['Score Percentage'] ?? '') || 0
    if (scorePct > 0 && scorePct <= 1.0001) scorePct *= 100

    const eventDate = row['Event Date'] ?? ''
    flatCalls.push({
      reference,
      scorePct,
      questions,
      date: eventDate.split(/\s+/)[0]?.trim() ?? '',
      duration: row['Event Duration'] ?? '',
      range: row['Range'] ?? '',
      eventType: parseEventType(row['Event Type']),
    })
  }

  const callCount = flatCalls.length
  const scores = flatCalls.map((c) => c.scorePct)
  const lowScoreCount = scores.filter((s) => s <= 60).length
  const avgScore = callCount ? scores.reduce((a, b) => a + b, 0) / callCount : 0
  const passRate = callCount
    ? Math.round(((scores.filter((s) => s >= 76).length / callCount) * 10000) / 100)
    : 0

  const calls: CallSummary[] = flatCalls.map((c) => ({
    ref: c.reference,
    score: c.scorePct,
    date: c.date,
    duration: c.duration,
    range: c.range,
    eventType: c.eventType,
  }))

  const reviewerNotes: ReviewerNote[] = []
  for (const call of flatCalls) {
    for (const qDef of QUESTION_COLUMNS) {
      const q = call.questions[qDef.id]
      if (!q?.isFailing || !q.comment?.trim()) continue
      reviewerNotes.push({
        ref: call.reference,
        section: qDef.section,
        question: qDef.label,
        answer: '',
        comment: q.comment.trim(),
        questionPct: 0,
      })
    }
    const g = call.questions['7.6']
    if (g?.comment?.trim()) {
      reviewerNotes.push({
        ref: call.reference,
        section: 'General',
        question: 'General Comments',
        answer: '',
        comment: g.comment.trim(),
        questionPct: 0,
      })
    }
  }

  const sectionStats = computeSectionZeroTotalFromFlat(flatCalls)
  const sectionStatsChart = computeSectionStatsChartFromFlat(flatCalls)
  const dates = [...new Set(flatCalls.map((c) => c.date).filter(Boolean))]

  let issueRefs = buildIssueRefsFromScorecard(flatCalls)
  issueRefs = mergeIssueRefsFromNotes(reviewerNotes, issueRefs)
  const issueInteractionBreakdown = issueBreakdownFromRefMap(issueRefs)

  const detectedIssues: DetectedIssue[] = []
  for (const { issueId, interactionIds } of issueInteractionBreakdown) {
    const def = ISSUE_BY_ID[issueId]
    if (!def || interactionIds.length === 0) continue
    detectedIssues.push({
      priority: def.priority,
      title: def.title,
      count: interactionIds.length,
      section: 'Scorecard',
    })
  }
  detectedIssues.sort((a, b) => b.count - a.count)
  if (detectedIssues.length === 0 && lowScoreCount > 0) {
    detectedIssues.push({
      priority: 'p1',
      title: 'Low-scoring calls in ingest (≤60%)',
      count: lowScoreCount,
      section: 'Aggregate',
    })
  }

  const reviewerNotesByIssueId = buildReviewerNotesByIssueId(flatCalls)

  const sortedScores = [...scores].sort((a, b) => a - b)
  const medianScore = Math.round(median(sortedScores) * 10) / 10
  const voiceCount = calls.filter((c) => c.eventType === 'Voice').length
  const chatCount = calls.filter((c) => c.eventType === 'Chat').length
  const dailyTrend = buildDailyTrend(calls)

  return {
    format: 'v5-flat',
    callCount,
    lowScoreCount,
    avgScore,
    medianScore,
    voiceCount,
    chatCount,
    dailyTrend,
    passRate,
    detectedIssues,
    sectionStats,
    sectionStatsChart,
    dates,
    issueInteractionBreakdown,
    reviewerNotes,
    reviewerNotesByIssueId,
    calls,
    scoreDistribution: buildScoreDistributionFromCalls(calls),
  }
}

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
    { score: number; date: string; duration: string; range: string; eventType?: 'Voice' | 'Chat' }
  >()

  for (const row of rows) {
    const ref = normalizeRef(row['Reference'])
    if (!ref || callMap.has(ref)) continue

    let score = parseFloat(row['Score Percentage'] ?? '') || 0
    if (score > 0 && score <= 1.0001) score *= 100

    const eventDate = row['Event Date'] ?? ''
    callMap.set(ref, {
      score,
      date: eventDate.split(/\s+/)[0]?.trim() ?? '',
      duration: row['Event Duration'] ?? '',
      range: row['Range'] ?? '',
      eventType: parseEventType(row['Event Type']),
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
      ref: normalizeRef(row['Reference']),
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

  const passRate = callCount
    ? Math.round(((scores.filter((s) => s >= 76).length / callCount) * 10000) / 100)
    : 0

  const sectionStatsChart = sectionStatsChartFromZeroTotal(sectionStats)

  const sortedScores = [...scores].sort((a, b) => a - b)
  const medianScore = Math.round(median(sortedScores) * 10) / 10
  const voiceCount = calls.filter((c) => c.eventType === 'Voice').length
  const chatCount = calls.filter((c) => c.eventType === 'Chat').length
  const dailyTrend = buildDailyTrend(calls)

  return {
    format: 'v4-multirow',
    callCount,
    lowScoreCount,
    avgScore,
    medianScore,
    voiceCount,
    chatCount,
    dailyTrend,
    passRate,
    detectedIssues,
    sectionStats,
    sectionStatsChart,
    dates,
    issueInteractionBreakdown,
    reviewerNotes,
    calls,
    scoreDistribution: buildScoreDistributionFromCalls(calls),
  }
}

function sectionStatsChartFromZeroTotal(
  sectionStats: Record<string, { zero: number; total: number }>
): Array<{ section: string; scorePercent: number }> {
  return Object.entries(sectionStats).map(([section, { zero, total }]) => ({
    section,
    scorePercent:
      total > 0 ? Math.round(((total - zero) / total) * 10000) / 100 : 0,
  }))
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

  const passRate =
    scores.length > 0
      ? Math.round(((scores.filter((s) => s >= 76).length / scores.length) * 10000) / 100)
      : 0

  const chartStats = sectionStatsChartFromZeroTotal(sectionStats)

  return {
    format: 'v4-multirow',
    callCount,
    lowScoreCount,
    avgScore,
    passRate,
    detectedIssues: detectedIssues.slice(0, 50),
    sectionStats,
    sectionStatsChart: chartStats,
    dates,
    issueInteractionBreakdown,
    reviewerNotes: [],
    calls: [],
    scoreDistribution: emptyScoreBuckets(),
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

  const headersTrimmed = fields.map((f) => f.trim())
  const fmt = detectCSVFormat(headersTrimmed)
  const headerSet = new Set(headersTrimmed)

  if (
    rows.length &&
    fmt === 'v5-flat' &&
    headerSet.has('Reference') &&
    headerSet.has('Score Percentage')
  ) {
    return parseV5FlatQC(rows)
  }

  if (rows.length && isV4QcExport(fields)) {
    return parseV4QC(rows)
  }

  return parseLegacyQC(rows, fields)
}
