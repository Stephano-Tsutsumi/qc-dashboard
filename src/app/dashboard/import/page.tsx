'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

type ParseResult = {
  callCount: number
  lowScoreCount: number
  avgScore: number
  medianScore?: number
  voiceCount?: number
  chatCount?: number
  dailyTrend?: Array<{ date: string; voice: number | null; chat: number | null }>
  detectedIssues: Array<{ priority: string; title: string; count: number; section: string }>
  issueInteractionBreakdown: Array<{ issueId: string; interactionIds: string[] }>
  sectionStats: Record<string, { zero: number; total: number }>
  dates: string[]
  reviewerNotes: Array<{
    ref: string
    section: string
    question: string
    answer: string
    comment: string
    questionPct: number
  }>
  calls: Array<{
    ref: string
    score: number
    date: string
    duration: string
    range: string
    eventType?: 'Voice' | 'Chat'
  }>
  format?: 'v4-multirow' | 'v5-flat'
  passRate?: number
  scoreDistribution?: Record<string, { count: number; refs: string[] }>
  sectionStatsChart?: Array<{ section: string; scorePercent: number }>
  reviewerNotesByIssueId?: Record<string, Array<{ label: string; text: string }>>
  aiIssueCards?: {
    p0: Array<{ title: string; desc: string; cats: string[]; refs: string[]; scores: number[]; notes: Array<{ ref: string | null; score: number | null; comment: string }>; action: string }>
    p1: Array<{ title: string; desc: string; cats: string[]; refs: string[]; scores: number[]; notes: Array<{ ref: string | null; score: number | null; comment: string }>; action: string }>
    p2: Array<{ title: string; desc: string; cats: string[]; refs: string[]; scores: number[]; notes: Array<{ ref: string | null; score: number | null; comment: string }>; action: string }>
    p3: Array<{ title: string; desc: string; cats: string[]; refs: string[]; scores: number[]; notes: Array<{ ref: string | null; score: number | null; comment: string }>; action: string }>
  }
  csvFilename: string
  aiSummary: string
  aiRecommendations: string
}

export default function ImportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [label, setLabel] = useState('')
  const [reportDate, setReportDate] = useState('')

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setError(null)
      setLoading(true)
      setPreview(null)
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch('/api/csv/parse', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      setLoading(false)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data: ParseResult = await res.json()
      setPreview(data)
      if (data.dates[0]) {
        setReportDate(data.dates[0].slice(0, 10))
      }
      setLabel((prev) => {
        if (prev) return prev
        if (data.dates.length)
          return `Week of ${data.dates[data.dates.length - 1] ?? data.dates[0]}`
        return 'New import'
      })
    },
    []
  )

  async function confirmImport() {
    if (!preview) return
    setError(null)
    setLoading(true)
    const res = await fetch('/api/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        label: label || 'Import',
        report_date: reportDate || new Date().toISOString().slice(0, 10),
        call_count: preview.callCount,
        low_score_count: preview.lowScoreCount,
        avg_score: preview.avgScore,
        issues_detected: preview.detectedIssues.length,
        ai_summary: preview.aiSummary,
        ai_recommendations: preview.aiRecommendations,
        stats_json: {
          format: preview.format,
          passRate: preview.passRate,
          medianScore: preview.medianScore,
          voiceCount: preview.voiceCount,
          chatCount: preview.chatCount,
          dailyTrend: preview.dailyTrend,
          scoreDistribution: preview.scoreDistribution,
          sectionStatsChart: preview.sectionStatsChart,
          reviewerNotesByIssueId: preview.reviewerNotesByIssueId,
          sectionStats: preview.sectionStats,
          detectedIssues: preview.detectedIssues,
          issueInteractionBreakdown: preview.issueInteractionBreakdown,
          reviewerNotes: preview.reviewerNotes,
          calls: preview.calls,
          dates: preview.dates,
          aiIssueCards: preview.aiIssueCards,
        },
        csv_filename: preview.csvFilename,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      const msg = j.details ? `${j.error ?? 'Error'}: ${j.details}` : (j.error ?? `HTTP ${res.status}`)
      setError(typeof msg === 'string' ? msg : `HTTP ${res.status}`)
      return
    }
    router.push('/dashboard/tracker')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Import CSV</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a QC export. Parsing uses heuristics until the exact format is wired from v4 HTML.
        </p>
      </div>

      <div
        className="rounded border border-dashed border-border-strong bg-surface p-8 text-center shadow-sm"
        style={{ borderRadius: 'var(--radius)' }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="mx-auto block max-w-sm text-sm"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          disabled={loading}
        />
        {loading && <p className="mt-4 text-sm text-text-muted">Processing…</p>}
      </div>

      {error && (
        <p className="rounded-sm border border-p0-border bg-p0-bg px-3 py-2 text-sm text-p0">
          {error}
        </p>
      )}

      {preview && (
        <div className="space-y-4">
          <div
            className="grid gap-4 rounded border border-border bg-surface p-4 sm:grid-cols-2"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <div>
              <div className="text-xs text-text-muted">Calls</div>
              <div className="text-lg font-semibold">{preview.callCount}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Avg score</div>
              <div className="text-lg font-semibold">{preview.avgScore.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Low score (≤60%)</div>
              <div className="text-lg font-semibold">{preview.lowScoreCount}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">File</div>
              <div className="text-sm font-medium">{preview.csvFilename}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-text-muted">Catalog linkage (this import)</div>
              <div className="text-lg font-semibold">
                {preview.issueInteractionBreakdown.length} catalog issue
                {preview.issueInteractionBreakdown.length === 1 ? '' : 's'}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                One interaction ID can appear under several catalog issues when multiple findings
                match.
              </p>
            </div>
          </div>

          {(preview.aiSummary || preview.aiRecommendations) && (
            <div
              className="rounded border border-border bg-surface p-4 shadow-sm"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <h2 className="text-sm font-semibold text-text">AI insights</h2>
              {preview.aiSummary && (
                <p className="mt-2 text-sm text-text-secondary">{preview.aiSummary}</p>
              )}
              {preview.aiRecommendations && (
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-text-secondary">
                  {preview.aiRecommendations}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-muted">Label</label>
              <input
                className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="sm:w-48">
              <label className="block text-xs font-medium text-text-muted">Report date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={confirmImport}
              disabled={loading}
              className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save snapshot
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
