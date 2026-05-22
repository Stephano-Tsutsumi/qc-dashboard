import type { ReviewerNote, CallSummary, AIIssueReport } from '@/types/csv'

// P-level regex patterns — ported from generate_report-2.py
const P_PATTERNS: Record<'p0' | 'p1' | 'p2' | 'p3', RegExp> = {
  p0: /no input|no output|fictional|fabricat|hallucin|barge.in|too many attempt/i,
  p1: /agent.*account|broker.*agent|agent.*represent|was an agent|not a member|before.*done talking|only picked up partial|1095a.*resend|look at my account|preference flow.*instead|transfer denial|contact center.*closed|informed.*closed/i,
  p2: /attempted to assist.*instead|eligibility estim|not equipped|outside.*capabilit|out.of.scope|no further services|closing statement.*only|wrap.up|survey.*not|empathy|frustrat|changed.*pitch|sentiment.*neutral/i,
  p3: /zip code.*paused|first digit.*zip|OTP.*background|unlimited attempt|screen pop|callback permission|manually.*search|manually.*look|should.*carrier|direct.*carrier|carrier.*instead/i,
}

export type PLevelBundle = Array<{ ref: string; score: number | null; comment: string }>
export type PLevelBundles = Record<'p0' | 'p1' | 'p2' | 'p3', PLevelBundle>

/**
 * Classify reviewer notes into P-level buckets, enriched with the call's score.
 * A comment may match multiple P-levels; it appears in each matching bucket.
 * Up to 30 entries per bucket (mirrors Python's head(30)).
 */
export function buildPLevelBundles(
  reviewerNotes: ReviewerNote[],
  calls: CallSummary[]
): PLevelBundles {
  const scoreByRef = new Map<string, number>()
  for (const c of calls) scoreByRef.set(c.ref, c.score)

  const bundles: PLevelBundles = { p0: [], p1: [], p2: [], p3: [] }

  for (const note of reviewerNotes) {
    const comment = note.comment?.trim()
    if (!comment) continue
    const score = scoreByRef.get(note.ref) ?? null
    for (const level of ['p0', 'p1', 'p2', 'p3'] as const) {
      if (bundles[level].length >= 30) continue
      if (P_PATTERNS[level].test(comment)) {
        bundles[level].push({
          ref: note.ref || 'unlinked',
          score: score !== null ? Math.round(score * 10) / 10 : null,
          comment: comment.slice(0, 300),
        })
      }
    }
  }

  return bundles
}

/**
 * Build the Claude prompt for P-level issue synthesis.
 * Asks Claude to return strict JSON matching AIIssueReport shape.
 */
export function buildIssuesLLMPrompt(bundles: PLevelBundles): string {
  const commentsBlock = JSON.stringify(bundles, null, 2)
  return `You are a QA analyst writing a product bug report for an AI virtual agent called AVA/IVA.

Below are raw QC reviewer comments from call evaluations, grouped into four priority buckets:
- p0: Critical bugs (data integrity, hallucination, fabrication)
- p1: ASR / NLP failures (intent misrouting, capture failures, STT errors)
- p2: Script / Grammar issues (out-of-scope handling, wrap-up, empathy, wrong info)
- p3: Workflow / Design gaps (auth flows, screen pop, transfer routing, context loss)

Each comment includes the interaction reference ID and overall score.

RAW COMMENTS:
${commentsBlock}

Your task: For each priority level that has comments, identify 1–4 distinct issue patterns and write a structured issue card for each.

Return ONLY a JSON object in exactly this shape — no preamble, no markdown, no explanation:
{
  "p0": [
    {
      "title": "Short specific issue title (max 12 words)",
      "desc": "2–3 sentence description of the problem pattern, what causes it, and its impact on callers.",
      "cats": ["Tag1", "Tag2"],
      "refs": ["refID1", "refID2"],
      "scores": [score1, score2],
      "notes": [
        {"ref": "refID", "score": 00.0, "comment": "verbatim or lightly edited reviewer comment"}
      ],
      "action": "Specific, actionable recommended fix for the dev team. 2–4 sentences."
    }
  ],
  "p1": [],
  "p2": [],
  "p3": []
}

Rules:
- Only include a level if it has real comments. Use [] for empty levels.
- notes: include 2–4 of the most useful reviewer comments per issue card.
- refs/scores: list the interaction IDs and scores associated with this issue.
- cats: 1–3 short category tags (e.g. "STT", "Auth", "OOS Detection").
- Do not invent information not present in the comments.
- Return valid JSON only.`
}

/**
 * Parse and validate the raw Claude response into an AIIssueReport.
 * Strips accidental markdown fences and falls back to empty arrays on parse failure.
 */
export function parseAIIssueReportFromResponse(raw: string): AIIssueReport {
  const empty: AIIssueReport = { p0: [], p1: [], p2: [], p3: [] }
  try {
    let text = raw.trim()
    if (text.startsWith('```')) {
      text = text.split('\n').slice(1).join('\n')
    }
    if (text.endsWith('```')) {
      text = text.split('\n').slice(0, -1).join('\n')
    }
    const parsed = JSON.parse(text.trim()) as Record<string, unknown>
    const levels = ['p0', 'p1', 'p2', 'p3'] as const
    const result: AIIssueReport = { p0: [], p1: [], p2: [], p3: [] }
    for (const level of levels) {
      const cards = parsed[level]
      if (!Array.isArray(cards)) continue
      for (const card of cards) {
        if (!card || typeof card !== 'object') continue
        const c = card as Record<string, unknown>
        result[level].push({
          title: typeof c.title === 'string' ? c.title : '',
          desc: typeof c.desc === 'string' ? c.desc : '',
          cats: Array.isArray(c.cats) ? (c.cats as string[]) : [],
          refs: Array.isArray(c.refs) ? (c.refs as string[]) : [],
          scores: Array.isArray(c.scores) ? (c.scores as number[]) : [],
          notes: Array.isArray(c.notes)
            ? (c.notes as Array<Record<string, unknown>>).map((n) => ({
                ref: typeof n.ref === 'string' ? n.ref : null,
                score: typeof n.score === 'number' ? n.score : null,
                comment: typeof n.comment === 'string' ? n.comment : '',
              }))
            : [],
          action: typeof c.action === 'string' ? c.action : '',
        })
      }
    }
    return result
  } catch {
    return empty
  }
}
