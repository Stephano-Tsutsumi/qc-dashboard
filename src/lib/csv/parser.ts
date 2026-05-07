import Papa from 'papaparse'
import type { ParsedReport, DetectedIssue } from '@/types/csv'

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

/** Heuristic QC CSV parser — refine when `ava_qc_report_v4` sample is available. */
export function parseQCCSV(csvText: string): ParsedReport {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  const fields = result.meta.fields?.filter(Boolean) ?? []
  const rows = result.data.filter((r) => Object.keys(r).some((k) => r[k]?.trim()))

  const scoreKey =
    fields.find((f) => /overall|total|final|score|percent/i.test(f)) ?? fields[0]

  const scores: number[] = []
  for (const row of rows) {
    const sc = parseScore(scoreKey ? row[scoreKey] : undefined)
    if (sc != null) scores.push(sc)
  }

  const callCount = rows.length
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const lowScoreCount = scores.filter((s) => s <= 60).length

  const sectionStats: Record<string, { zero: number; total: number }> = {}
  for (const f of fields) {
    if (f === scoreKey) continue
    if (!/[a-z]/i.test(f)) continue
    let zero = 0
    let total = 0
    for (const row of rows) {
      const v = row[f]
      if (v == null || v === '') continue
      total++
      if (isZeroLike(v) || parseScore(v) === 0) zero++
    }
    if (total > 0) sectionStats[f] = { zero, total }
  }

  const dates: string[] = []
  const dateKey = fields.find((f) => /date|week|report/i.test(f))
  if (dateKey) {
    for (const row of rows) {
      const d = row[dateKey]?.trim()
      if (d && !dates.includes(d)) dates.push(d)
    }
  }

  const detectedIssues: DetectedIssue[] = []
  const commentKeys = fields.filter((f) => /comment|note|qc|failure|issue|finding/i.test(f))
  for (const f of commentKeys) {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const text = row[f]?.trim()
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
  }
}
