import type {
  CallSummary,
  DetectedIssue,
  IssueInteractionBreakdown,
  ReviewerNote,
  SnapshotScoreBucket,
  SnapshotScoreBucketKey,
  DailyTrendPoint,
  AIIssueReport,
  AIIssueCard,
  AIIssueNote,
} from '@/types/csv'
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

/** Catalog issue IDs that appear in this snapshot (interaction breakdown or legacy detections). */
export function getIssueIdsFromStatsJson(statsJson: unknown): Set<string> {
  return new Set(buildWeekIssueSignalMapFromStatsJson(statsJson).keys())
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

const SCORE_BUCKETS: SnapshotScoreBucketKey[] = ['lte50', 'lte60', 'lte70', 'lte75', 'pass']

function bucketForOverallScore(score: number): SnapshotScoreBucketKey {
  if (score <= 50) return 'lte50'
  if (score <= 60) return 'lte60'
  if (score <= 70) return 'lte70'
  if (score <= 75) return 'lte75'
  return 'pass'
}

function emptyScoreDistribution(): Record<SnapshotScoreBucketKey, SnapshotScoreBucket> {
  const z = (): SnapshotScoreBucket => ({ count: 0, refs: [] })
  return {
    lte50: z(),
    lte60: z(),
    lte70: z(),
    lte75: z(),
    pass: z(),
  }
}

export function parseCallsFromStatsJson(statsJson: unknown): CallSummary[] {
  if (!statsJson || typeof statsJson !== 'object') return []
  const raw = (statsJson as Record<string, unknown>).calls
  if (!Array.isArray(raw)) return []
  const out: CallSummary[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const ref = typeof o.ref === 'string' ? o.ref.trim() : ''
    if (!ref) continue
    const score =
      typeof o.score === 'number' && Number.isFinite(o.score) ? o.score : Number(o.score) || 0
    const date = typeof o.date === 'string' ? o.date : ''
    const duration = typeof o.duration === 'string' ? o.duration : ''
    const range = typeof o.range === 'string' ? o.range : ''
    out.push({ ref, score, date, duration, range })
  }
  return out
}

export function buildRefToScoreMap(statsJson: unknown): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of parseCallsFromStatsJson(statsJson)) {
    m.set(c.ref.trim(), c.score)
  }
  return m
}

export function scoreRangesForRefs(
  refs: string[] | undefined,
  scoreByRef: Map<string, number>
): SnapshotScoreBucketKey[] {
  if (!refs?.length) return []
  const keys = new Set<SnapshotScoreBucketKey>()
  for (const ref of refs) {
    const s = scoreByRef.get(ref.trim())
    if (s === undefined) continue
    keys.add(bucketForOverallScore(s))
  }
  return [...keys]
}

export function parseScoreDistributionFromStatsJson(
  statsJson: unknown
): Record<SnapshotScoreBucketKey, SnapshotScoreBucket> | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).scoreDistribution
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out = emptyScoreDistribution()
  for (const key of SCORE_BUCKETS) {
    const b = r[key]
    if (!b || typeof b !== 'object') return null
    const o = b as Record<string, unknown>
    const count = typeof o.count === 'number' ? o.count : Number(o.count) || 0
    const refs = Array.isArray(o.refs)
      ? o.refs.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
    out[key] = { count, refs }
  }
  return out
}

function buildScoreDistributionFromCalls(
  calls: CallSummary[]
): Record<SnapshotScoreBucketKey, SnapshotScoreBucket> {
  const dist = emptyScoreDistribution()
  for (const c of calls) {
    const key = bucketForOverallScore(c.score)
    dist[key].count++
    dist[key].refs.push(c.ref)
  }
  return dist
}

export function parseSectionStatsChartFromStatsJson(
  statsJson: unknown
): Array<{ section: string; scorePercent: number }> | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).sectionStatsChart
  if (!Array.isArray(raw)) return null
  const out: Array<{ section: string; scorePercent: number }> = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const section = typeof o.section === 'string' ? o.section : ''
    const scorePercent =
      typeof o.scorePercent === 'number' && Number.isFinite(o.scorePercent)
        ? o.scorePercent
        : Number(o.scorePercent) || 0
    if (section) out.push({ section, scorePercent })
  }
  return out.length ? out : null
}

function fallbackSectionChartFromSectionStats(
  sectionStats: unknown
): Array<{ section: string; scorePercent: number }> {
  if (!sectionStats || typeof sectionStats !== 'object') return []
  const rec = sectionStats as Record<string, { zero?: unknown; total?: unknown }>
  return Object.entries(rec).map(([section, v]) => {
    const zero = typeof v.zero === 'number' ? v.zero : Number(v.zero) || 0
    const total = typeof v.total === 'number' ? v.total : Number(v.total) || 0
    const scorePercent =
      total > 0 ? Math.round(((total - zero) / total) * 10000) / 100 : 0
    return { section, scorePercent }
  })
}

export function parseReviewerNotesByIssueIdFromStatsJson(
  statsJson: unknown
): Record<string, Array<{ label: string; text: string }>> | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).reviewerNotesByIssueId
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, Array<{ label: string; text: string }>> = {}
  for (const [issueId, arr] of Object.entries(raw)) {
    if (!Array.isArray(arr)) continue
    const notes: Array<{ label: string; text: string }> = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const label = typeof o.label === 'string' ? o.label : ''
      const text = typeof o.text === 'string' ? o.text : ''
      if (!text.trim()) continue
      notes.push({ label, text })
    }
    if (notes.length) out[issueId] = notes
  }
  return Object.keys(out).length ? out : null
}

export function parseSnapshotFormat(statsJson: unknown): 'v4-multirow' | 'v5-flat' {
  if (!statsJson || typeof statsJson !== 'object') return 'v4-multirow'
  return (statsJson as Record<string, unknown>).format === 'v5-flat' ? 'v5-flat' : 'v4-multirow'
}

export function parseDailyTrendFromStatsJson(statsJson: unknown): DailyTrendPoint[] | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).dailyTrend
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: DailyTrendPoint[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const date = typeof o.date === 'string' ? o.date : ''
    if (!date) continue
    const voice =
      typeof o.voice === 'number' && Number.isFinite(o.voice) ? o.voice : null
    const chat =
      typeof o.chat === 'number' && Number.isFinite(o.chat) ? o.chat : null
    out.push({ date, voice, chat })
  }
  return out.length ? out : null
}

export function parseAIIssueCardsFromStatsJson(statsJson: unknown): AIIssueReport | null {
  if (!statsJson || typeof statsJson !== 'object') return null
  const raw = (statsJson as Record<string, unknown>).aiIssueCards
  if (!raw || typeof raw !== 'object') return null
  const levels = ['p0', 'p1', 'p2', 'p3'] as const
  const result: AIIssueReport = { p0: [], p1: [], p2: [], p3: [] }
  let hasAny = false
  for (const level of levels) {
    const cards = (raw as Record<string, unknown>)[level]
    if (!Array.isArray(cards)) continue
    for (const card of cards) {
      if (!card || typeof card !== 'object') continue
      const c = card as Record<string, unknown>
      const notes: AIIssueNote[] = Array.isArray(c.notes)
        ? (c.notes as Array<Record<string, unknown>>).map((n) => ({
            ref: typeof n.ref === 'string' ? n.ref : null,
            score: typeof n.score === 'number' ? n.score : null,
            comment: typeof n.comment === 'string' ? n.comment : '',
          }))
        : []
      const parsed: AIIssueCard = {
        title: typeof c.title === 'string' ? c.title : '',
        desc: typeof c.desc === 'string' ? c.desc : '',
        cats: Array.isArray(c.cats) ? (c.cats as string[]) : [],
        refs: Array.isArray(c.refs) ? (c.refs as string[]) : [],
        scores: Array.isArray(c.scores) ? (c.scores as number[]) : [],
        notes,
        action: typeof c.action === 'string' ? c.action : '',
      }
      if (parsed.title) {
        result[level].push(parsed)
        hasAny = true
      }
    }
  }
  return hasAny ? result : null
}

export type ScoreDistributionBar = SnapshotScoreBucket & { heightPx: number }

export type DashboardWeekInsights = {
  format: 'v4-multirow' | 'v5-flat'
  changelogItems: string[]
  sectionStatsChart: Array<{ section: string; scorePercent: number }>
  scoreDistribution: Record<SnapshotScoreBucketKey, ScoreDistributionBar>
  passRate: number | null
  criticalFailCount: number
  medianScore: number | null
  voiceCount: number | null
  chatCount: number | null
  dailyTrend: DailyTrendPoint[] | null
  aiIssueCards: AIIssueReport | null
}

function buildChangelogItems(statsJson: unknown): string[] {
  const items: string[] = []
  const breakdown = parseIssueInteractionBreakdownFromStatsJson(statsJson)
  const calls = parseCallsFromStatsJson(statsJson)
  const totalCalls = calls.length

  const grammar = breakdown?.find((b) => b.issueId === 'p2-grammar-script')
  if (grammar && grammar.interactionIds.length > 0 && totalCalls > 0) {
    items.push(
      `Grammar Accuracy (Q4.5) failing in **${grammar.interactionIds.length}/${totalCalls} calls** — review callback script wording`
    )
  }

  const topics = breakdown?.find((b) => b.issueId === 'p1-call-topics')
  if (topics && topics.interactionIds.length > 0) {
    items.push(`Call Topics (Q8.7) flagged across **${topics.interactionIds.length} calls**`)
  }

  items.unshift(
    'New flat one-row-per-call CSV format — issues map to **scorecard question IDs**.'
  )
  return items
}

export function buildDashboardWeekInsights(statsJson: unknown): DashboardWeekInsights {
  const emptyBase = (): DashboardWeekInsights => {
    const emptyDist = emptyScoreDistribution()
    const maxCount = 1
    const scoreDistribution = {} as DashboardWeekInsights['scoreDistribution']
    for (const key of SCORE_BUCKETS) {
      const d = emptyDist[key]
      scoreDistribution[key] = {
        ...d,
        heightPx: Math.max(3, Math.round((d.count / maxCount) * 28)),
      }
    }
    return {
      format: 'v4-multirow',
      changelogItems: [],
      sectionStatsChart: [],
      scoreDistribution,
      passRate: null,
      criticalFailCount: 0,
      medianScore: null,
      voiceCount: null,
      chatCount: null,
      dailyTrend: null,
      aiIssueCards: null,
    }
  }

  if (!statsJson || typeof statsJson !== 'object') return emptyBase()

  const o = statsJson as Record<string, unknown>
  const format = parseSnapshotFormat(statsJson)

  const calls = parseCallsFromStatsJson(statsJson)
  let distRaw = parseScoreDistributionFromStatsJson(statsJson)
  if (!distRaw && calls.length > 0) distRaw = buildScoreDistributionFromCalls(calls)
  if (!distRaw) distRaw = emptyScoreDistribution()

  const maxCount = Math.max(...Object.values(distRaw).map((d) => d.count), 1)
  const scoreDistribution = {} as DashboardWeekInsights['scoreDistribution']
  for (const key of SCORE_BUCKETS) {
    const d = distRaw[key]
    scoreDistribution[key] = {
      ...d,
      heightPx: Math.max(3, Math.round((d.count / maxCount) * 28)),
    }
  }

  const sectionStatsChart =
    parseSectionStatsChartFromStatsJson(statsJson) ??
    fallbackSectionChartFromSectionStats(o.sectionStats)

  const changelogItems = format === 'v5-flat' ? buildChangelogItems(statsJson) : []

  const passRate =
    typeof o.passRate === 'number' && Number.isFinite(o.passRate) ? o.passRate : null

  const medianScore =
    typeof o.medianScore === 'number' && Number.isFinite(o.medianScore) ? o.medianScore : null

  const voiceCount =
    typeof o.voiceCount === 'number' && Number.isFinite(o.voiceCount) ? o.voiceCount : null

  const chatCount =
    typeof o.chatCount === 'number' && Number.isFinite(o.chatCount) ? o.chatCount : null

  const dailyTrend = parseDailyTrendFromStatsJson(statsJson)

  const aiIssueCards = parseAIIssueCardsFromStatsJson(statsJson)

  return {
    format,
    changelogItems,
    sectionStatsChart,
    scoreDistribution,
    passRate,
    criticalFailCount: distRaw.lte50.count,
    medianScore,
    voiceCount,
    chatCount,
    dailyTrend,
    aiIssueCards,
  }
}
