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

  const { data, error } = await supabase
    .from('weekly_snapshots')
    .insert({
      label: body.label,
      report_date: body.report_date,
      call_count: body.call_count,
      low_score_count: body.low_score_count,
      avg_score: body.avg_score,
      issues_detected: body.issues_detected,
      ai_summary: body.ai_summary,
      ai_recommendations: body.ai_recommendations,
      stats_json: body.stats_json as Json,
      csv_filename: body.csv_filename,
      imported_by: user.id,
    })
    .select()
    .single()

  if (error || !data) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 })
  }

  return NextResponse.json({ week: data })
}
