/**
 * Maps flat scorecard question IDs → catalog issue IDs (`issues.ts`).
 * One question may surface multiple catalog issues when overlapping themes apply.
 *
 * Covers every scored column in `QUESTION_COLUMNS` (reuse-only Phase 1: all targets must exist in `ALL_ISSUES`).
 */
export const SCORECARD_QUESTION_TO_ISSUE_IDS: Record<string, string[]> = {
  // NLU / Intent
  '1.1': ['p1-agent-misrouted'],
  '1.2': ['p1-transcription', 'p1-barge-in'],
  '1.4': ['p2-clarification', 'p2-workflow-order'],

  // Authentication
  '2.1': ['p3-reauth', 'p3-no-callback'],
  '2.2': ['p3-reauth', 'p0-otp-failure'],
  '2.3': ['p3-reauth', 'p3-no-callback'],
  '2.4': ['p3-reauth', 'p3-no-callback', 'p0-otp-failure'],

  // Task Completion
  '3.1': ['p2-workflow-order', 'p1-agent-misrouted'],
  '3.2': ['p2-task-confirm'],
  '3.3': ['p2-workflow-order', 'p0-flow-failure'],

  // User Experience
  '4.1': ['p2-grammar-script'],
  '4.2': ['p2-empathy'],
  '4.3': ['p1-transcription', 'p3-reauth', 'p1-agent-misrouted'],
  '4.4': ['p1-fast-speech'],
  '4.5': ['p2-grammar-script'],

  // OOS Handling
  '5.1': ['p2-ooscope'],
  '5.2': ['p2-ooscope'],

  // Transfer Quality
  '6.1': ['p3-transfer-category'],
  '6.2': ['p3-transfer-context'],

  // Analytics (8.x)
  '8.2': ['p2-grammar-script'],
  '8.3': ['p3-reauth'],
  '8.4': ['p2-workflow-order'],
  '8.5': ['p3-analytics-quality'],
  '8.6': ['p3-analytics-quality'],
  '8.7': ['p1-call-topics'],
  '8.8': ['p3-transfer-category'],
  '8.10': ['p1-transcription', 'p1-barge-in'],
  '8.11': ['p3-analytics-quality'],
}

/** Catalog issue → scorecard question IDs shown as badges / note sources (v5). */
export const ISSUE_SCORECARD_QUESTIONS: Record<string, string[]> = (() => {
  const inv = new Map<string, Set<string>>()
  for (const [qid, issueIds] of Object.entries(SCORECARD_QUESTION_TO_ISSUE_IDS)) {
    for (const iid of issueIds) {
      if (!inv.has(iid)) inv.set(iid, new Set())
      inv.get(iid)!.add(qid)
    }
  }
  const out: Record<string, string[]> = {}
  for (const [iid, set] of inv) out[iid] = [...set].sort(compareQuestionIds)
  return out
})()

/**
 * Which scorecard columns supply reviewer-note text for an issue when building
 * `reviewerNotesByIssueId` (includes general comments where relevant).
 */
export function noteSourceQuestionIdsForIssue(issueId: string): string[] {
  const qs = ISSUE_SCORECARD_QUESTIONS[issueId]
  if (!qs?.length) return []
  const withGeneral = new Set(qs)
  withGeneral.add('7.6')
  return [...withGeneral].sort(compareQuestionIds)
}

/** Show "NEW" badge on v5 for issues primarily surfaced by flat scorecard analytics rows. */
export const ISSUE_NEW_IN_V5 = new Set<string>([
  'p2-grammar-script',
  'p1-call-topics',
  'p3-analytics-quality',
])

/** Channel axis for dashboard filters (sparse — default `both`). */
export const ISSUE_CHANNEL: Partial<Record<string, 'voice' | 'chat' | 'both'>> = {
  'p3-spanish-nlp': 'voice',
}

function compareQuestionIds(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return a.localeCompare(b)
}
