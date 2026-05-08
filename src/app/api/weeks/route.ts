import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Json } from '@/types/database'

export async function GET() {
  const supabase = createClient(cookies())
  const { data, error } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .order('report_date', { ascending: false })

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load weeks' }, { status: 500 })
  }

  return NextResponse.json({ weeks: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createClient(cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type Body = {
    label: string
    report_date: string
    call_count: number
    low_score_count: number
    avg_score: number
    issues_detected: number
    ai_summary: string
    ai_recommendations: string
    stats_json: Record<string, unknown>
    csv_filename: string
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reportDateRaw = (body.report_date ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateRaw)) {
    return NextResponse.json(
      { error: 'Invalid report_date', details: 'Use YYYY-MM-DD (e.g. from the date picker).' },
      { status: 400 }
    )
  }
  const d = new Date(`${reportDateRaw}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json({ error: 'Invalid report_date', details: 'Could not parse date.' }, { status: 400 })
  }

  const callCount = Math.max(0, Math.round(Number(body.call_count)) || 0)
  const lowScoreCount = Math.max(0, Math.round(Number(body.low_score_count)) || 0)
  const issuesDetected = Math.max(0, Math.round(Number(body.issues_detected)) || 0)
  let avgScore: number | null = Number(body.avg_score)
  if (!Number.isFinite(avgScore)) avgScore = null
  else avgScore = Math.round(Math.min(999.99, Math.max(-999.99, avgScore)) * 100) / 100

  const statsRaw = body.stats_json && typeof body.stats_json === 'object' ? body.stats_json : {}

  let statsParsed: Json
  try {
    statsParsed = JSON.parse(JSON.stringify(statsRaw)) as Json
  } catch {
    return NextResponse.json(
      { error: 'Invalid stats_json', details: 'Could not serialize import stats.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('weekly_snapshots')
    .insert({
      label: body.label?.trim() || 'Import',
      report_date: reportDateRaw,
      call_count: callCount,
      low_score_count: lowScoreCount,
      avg_score: avgScore,
      issues_detected: issuesDetected,
      ai_summary: body.ai_summary ?? '',
      ai_recommendations: body.ai_recommendations ?? '',
      stats_json: statsParsed,
      csv_filename: body.csv_filename ?? null,
      imported_by: user.id,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('weekly_snapshots insert:', error)
    return NextResponse.json(
      {
        error: 'Failed to save snapshot',
        details: error?.message ?? 'Unknown database error',
        code: error?.code,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ week: data })
}
