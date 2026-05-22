import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { parseQCCSV } from '@/lib/csv/parser'
import {
  buildPLevelBundles,
  buildIssuesLLMPrompt,
  parseAIIssueReportFromResponse,
} from '@/lib/prompts/csv-analysis'
import { anthropic } from '@/lib/anthropic'
import type { AIIssueCard } from '@/types/csv'

export async function POST(request: NextRequest) {
  const supabase = createClient(cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    let aiSummary = ''
    let aiRecommendations = ''
    let aiIssueCards = null

    if (process.env.ANTHROPIC_API_KEY) {
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7'

      // Build P-level comment bundles and send to Claude for structured issue synthesis
      const bundles = buildPLevelBundles(parsed.reviewerNotes, parsed.calls)
      const hasAnyComments = Object.values(bundles).some((b) => b.length > 0)

      if (hasAnyComments) {
        const issuesPrompt = buildIssuesLLMPrompt(bundles)
        const issuesResponse = await anthropic.messages.create({
          model,
          max_tokens: 3000,
          messages: [{ role: 'user', content: issuesPrompt }],
        })
        const issuesBlock = issuesResponse.content[0]
        const issuesText = issuesBlock?.type === 'text' ? issuesBlock.text : ''
        aiIssueCards = parseAIIssueReportFromResponse(issuesText)

        // Derive summary and recommendations from the structured issue cards
        const totalCards = Object.values(aiIssueCards).flat().length
        if (totalCards > 0) {
          const summaryPrompt = `Based on this QC week data:
- Calls reviewed: ${parsed.callCount}
- Average score: ${parsed.avgScore.toFixed(1)}%
- Median score: ${parsed.medianScore != null ? parsed.medianScore.toFixed(1) + '%' : 'n/a'}
- Calls ≤60%: ${parsed.lowScoreCount}
- Pass rate (≥76%): ${parsed.passRate != null ? parsed.passRate + '%' : 'n/a'}

P-level issue cards generated: ${JSON.stringify(
            Object.fromEntries(
              Object.entries(aiIssueCards).map(([k, v]) => [k, (v as AIIssueCard[]).map((c) => c.title)])
            ),
            null,
            2
          )}

Write a 2-3 sentence executive summary and a prioritized numbered action list (3-5 items).
Format as: SUMMARY: [text] ACTIONS: [numbered list]`

          const summaryResponse = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: summaryPrompt }],
          })
          const summaryBlock = summaryResponse.content[0]
          const summaryText = summaryBlock?.type === 'text' ? summaryBlock.text : ''
          const summaryMatch = summaryText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTIONS:|$)/i)
          const actionsMatch = summaryText.match(/ACTIONS:\s*([\s\S]*?)$/i)
          aiSummary = summaryMatch?.[1]?.trim() ?? ''
          aiRecommendations = actionsMatch?.[1]?.trim() ?? ''
        }
      } else {
        // No reviewer comments matched P-patterns — fall back to aggregate summary
        const fallbackPrompt = `You are a QC analyst reviewing weekly performance data for AVA, a virtual insurance agent.

WEEK STATS:
- Calls reviewed: ${parsed.callCount}
- Calls scored ≤60%: ${parsed.lowScoreCount}
- Average score: ${parsed.avgScore.toFixed(1)}%

Provide:
1. A 2-3 sentence executive summary of this week's quality status.
2. A prioritized list of 3-5 specific recommended actions.

Format as: SUMMARY: [text] ACTIONS: [numbered list]`

        const fallbackResponse = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: fallbackPrompt }],
        })
        const fallbackBlock = fallbackResponse.content[0]
        const fallbackText = fallbackBlock?.type === 'text' ? fallbackBlock.text : ''
        const summaryMatch = fallbackText.match(/SUMMARY:\s*([\s\S]*?)(?=ACTIONS:|$)/i)
        const actionsMatch = fallbackText.match(/ACTIONS:\s*([\s\S]*?)$/i)
        aiSummary = summaryMatch?.[1]?.trim() ?? ''
        aiRecommendations = actionsMatch?.[1]?.trim() ?? ''
      }
    }

    return NextResponse.json({
      callCount: parsed.callCount,
      lowScoreCount: parsed.lowScoreCount,
      avgScore: parsed.avgScore,
      medianScore: parsed.medianScore,
      voiceCount: parsed.voiceCount,
      chatCount: parsed.chatCount,
      dailyTrend: parsed.dailyTrend,
      detectedIssues: parsed.detectedIssues,
      issueInteractionBreakdown: parsed.issueInteractionBreakdown,
      sectionStats: parsed.sectionStats,
      dates: parsed.dates,
      reviewerNotes: parsed.reviewerNotes,
      calls: parsed.calls,
      format: parsed.format,
      passRate: parsed.passRate,
      scoreDistribution: parsed.scoreDistribution,
      sectionStatsChart: parsed.sectionStatsChart,
      reviewerNotesByIssueId: parsed.reviewerNotesByIssueId,
      csvFilename: file.name,
      aiSummary,
      aiRecommendations,
      aiIssueCards,
    })
  } catch (error) {
    console.error('CSV parse error:', error)
    return NextResponse.json({ error: 'Failed to process CSV' }, { status: 500 })
  }
}
