import type { DetectedIssue } from '@/types/csv'

export function buildAnalysisPrompt(
  sectionStats: Record<string, { zero: number; total: number }>,
  detectedIssues: DetectedIssue[],
  stats: { callCount: number; lowScoreCount: number; avgScore: number }
): string {
  const sectionLines = Object.entries(sectionStats)
    .map(([sec, { zero, total }]) => {
      const pct = total ? Math.round((zero / total) * 100) : 0
      return `- ${sec}: ${pct}% failure rate (${zero}/${total})`
    })
    .join('\n')

  const issueLines = detectedIssues
    .map((i) => `- [${i.priority.toUpperCase()}] ${i.title}: ${i.count} instances`)
    .join('\n')

  return `You are a QC analyst reviewing weekly performance data for AVA, a virtual insurance agent.

WEEK STATS:
- Calls reviewed: ${stats.callCount}
- Calls scored ≤60%: ${stats.lowScoreCount}
- Average score: ${stats.avgScore.toFixed(1)}%

SECTION FAILURE RATES:
${sectionLines || '- (none parsed)'}

DETECTED ISSUE PATTERNS:
${issueLines || '- (none parsed)'}

Provide:
1. A 2-3 sentence executive summary of this week's quality status.
2. A prioritized list of 3-5 specific recommended actions the development team should take this week, grounded in the data above.

Be specific and actionable. Reference exact failure rates and issue counts. Do not be generic.
Format as: SUMMARY: [text] ACTIONS: [numbered list]`
}
