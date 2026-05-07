import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { parseQCCSV } from '@/lib/csv/parser'
import { buildAnalysisPrompt } from '@/lib/prompts/csv-analysis'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  const supabase = createClient(cookies())
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const MAX_SIZE = 25 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 })
    }

    const csvText = await file.text()
    const parsed = parseQCCSV(csvText)

    const prompt = buildAnalysisPrompt(parsed.sectionStats, parsed.detectedIssues, {
      callCount: parsed.callCount,
      lowScoreCount: parsed.lowScoreCount,
      avgScore: parsed.avgScore,
    })

    let aiSummary = ''
    let aiRecommendations = ''

    if (process.env.ANTHROPIC_API_KEY) {
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'
      const aiResponse = await anthropic.messages.create({
        model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = aiResponse.content[0]
      const aiText = block?.type === 'text' ? block.text : ''
      const summaryMatch = aiText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTIONS:|$)/i)
      const actionsMatch = aiText.match(/ACTIONS:\s*([\s\S]*?)$/i)
      aiSummary = summaryMatch?.[1]?.trim() ?? ''
      aiRecommendations = actionsMatch?.[1]?.trim() ?? ''
    }

    return NextResponse.json({
      callCount: parsed.callCount,
      lowScoreCount: parsed.lowScoreCount,
      avgScore: parsed.avgScore,
      detectedIssues: parsed.detectedIssues,
      sectionStats: parsed.sectionStats,
      dates: parsed.dates,
      csvFilename: file.name,
      aiSummary,
      aiRecommendations,
    })
  } catch (error) {
    console.error('CSV parse error:', error)
    return NextResponse.json({ error: 'Failed to process CSV' }, { status: 500 })
  }
}
