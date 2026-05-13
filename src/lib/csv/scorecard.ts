/** v5 flat scorecard column definitions and score parsing (QC export). */

export type CSVFormat = 'v4-multirow' | 'v5-flat'

export type QuestionColumnDef = {
  col: string
  id: string
  label: string
  section: string
  isAnalytics: boolean
}

export const QUESTION_MAX_SCORES: Record<string, number> = {
  '1.1': 1,
  '1.2': 2,
  '1.4': 2,
  '2.1': 1,
  '2.2': 1,
  '2.3': 2,
  '2.4': 2,
  '3.1': 2,
  '3.2': 2,
  '3.3': 2,
  '4.1': 2,
  '4.2': 2,
  '4.3': 3,
  '4.4': 2,
  '4.5': 2,
  '5.1': 2,
  '5.2': 1,
  '6.1': 1,
  '6.2': 2,
}

export const QUESTION_COLUMNS: QuestionColumnDef[] = [
  {
    col: '1.1: User Intent Recognition',
    id: '1.1',
    label: 'User Intent Recognition',
    section: 'NLU / Intent',
    isAnalytics: false,
  },
  {
    col: '1.2: Input Capture / STT',
    id: '1.2',
    label: 'Input Capture / STT',
    section: 'NLU / Intent',
    isAnalytics: false,
  },
  {
    col: '1.4: Clarification Request',
    id: '1.4',
    label: 'Clarification Request',
    section: 'NLU / Intent',
    isAnalytics: false,
  },
  {
    col: '2.1: Auth Enforcement',
    id: '2.1',
    label: 'Auth Enforcement',
    section: 'Authentication',
    isAnalytics: false,
  },
  {
    col: '2.2: Auth Verification Items',
    id: '2.2',
    label: 'Auth Verification Items',
    section: 'Authentication',
    isAnalytics: false,
  },
  {
    col: '2.3: Non-Secure Task Handling',
    id: '2.3',
    label: 'Non-Secure Task Handling',
    section: 'Authentication',
    isAnalytics: false,
  },
  {
    col: '2.4: Auth Failure Handling',
    id: '2.4',
    label: 'Auth Failure Handling',
    section: 'Authentication',
    isAnalytics: false,
  },
  {
    col: '3.1: Primary Intent Completion',
    id: '3.1',
    label: 'Primary Intent Completion',
    section: 'Task Completion',
    isAnalytics: false,
  },
  {
    col: '3.2: Secondary Intent Completion',
    id: '3.2',
    label: 'Secondary Intent Completion',
    section: 'Task Completion',
    isAnalytics: false,
  },
  {
    col: '3.3: Workflow Navigation',
    id: '3.3',
    label: 'Workflow Navigation',
    section: 'Task Completion',
    isAnalytics: false,
  },
  {
    col: '4.1: Clear Language',
    id: '4.1',
    label: 'Clear Language',
    section: 'User Experience',
    isAnalytics: false,
  },
  {
    col: '4.2: Empathy & Tone',
    id: '4.2',
    label: 'Empathy & Tone',
    section: 'User Experience',
    isAnalytics: false,
  },
  {
    col: '4.3: User Satisfaction',
    id: '4.3',
    label: 'User Satisfaction',
    section: 'User Experience',
    isAnalytics: false,
  },
  {
    col: '4.4: TTS Quality',
    id: '4.4',
    label: 'TTS Quality',
    section: 'User Experience',
    isAnalytics: false,
  },
  {
    col: '4.5: Grammar Accuracy',
    id: '4.5',
    label: 'Grammar Accuracy',
    section: 'User Experience',
    isAnalytics: false,
  },
  {
    col: '5.1: OOS Detection',
    id: '5.1',
    label: 'OOS Detection',
    section: 'OOS Handling',
    isAnalytics: false,
  },
  {
    col: '5.2: Transfer for OOS',
    id: '5.2',
    label: 'Transfer for OOS',
    section: 'OOS Handling',
    isAnalytics: false,
  },
  {
    col: '6.1: Transfer Destination',
    id: '6.1',
    label: 'Transfer Destination',
    section: 'Transfer Quality',
    isAnalytics: false,
  },
  {
    col: '6.2: Context Passing',
    id: '6.2',
    label: 'Context Passing',
    section: 'Transfer Quality',
    isAnalytics: false,
  },
  {
    col: '8.2: Welcome Message',
    id: '8.2',
    label: 'Welcome Message',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.3: Auth Performed',
    id: '8.3',
    label: 'Auth Performed',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.4: Survey Offered',
    id: '8.4',
    label: 'Survey Offered',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.5: Summary',
    id: '8.5',
    label: 'Summary',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.6: Sentiment',
    id: '8.6',
    label: 'Sentiment',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.7: Call Topics',
    id: '8.7',
    label: 'Call Topics',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.8: Disposition',
    id: '8.8',
    label: 'Disposition',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.10: Transcription',
    id: '8.10',
    label: 'Transcription',
    section: 'Analytics',
    isAnalytics: true,
  },
  {
    col: '8.11: Redaction',
    id: '8.11',
    label: 'Redaction',
    section: 'Analytics',
    isAnalytics: true,
  },
]

export const GENERAL_COMMENT_COL = '7.6: General Comments Cmt'

export type QuestionScore = {
  questionId: string
  questionLabel: string
  rawValue: string
  numericScore: number | null
  maxScore: number | null
  scorePercent: number | null
  isFailing: boolean
  isNA: boolean
  comment: string | null
}

const FAIL_ON_ZERO_ONLY = new Set(['1.1', '2.2', '5.1', '5.2', '6.1', '4.3'])
const FAIL_ON_ZERO_OR_ONE = new Set([
  '1.2',
  '1.4',
  '2.4',
  '3.1',
  '3.2',
  '3.3',
  '4.1',
  '4.2',
  '4.4',
  '4.5',
  '6.2',
])

export function isQuestionFailing(questionId: string, score: number | null): boolean {
  if (score === null) return false
  if (FAIL_ON_ZERO_ONLY.has(questionId)) return score === 0
  if (FAIL_ON_ZERO_OR_ONE.has(questionId)) return score <= 1
  return score === 0
}

export function parseQuestionScore(
  questionId: string,
  questionLabel: string,
  rawValue: string | null | undefined,
  commentValue: string | null | undefined
): QuestionScore {
  if (!rawValue || rawValue.trim() === '') {
    return {
      questionId,
      questionLabel,
      rawValue: '',
      numericScore: null,
      maxScore: null,
      scorePercent: null,
      isFailing: false,
      isNA: true,
      comment: commentValue?.trim() || null,
    }
  }

  const trimmed = rawValue.trim()
  const isNA = /^N\/A/i.test(trimmed)
  const numMatch = trimmed.match(/^(\d+)/)
  const numericScore = numMatch ? parseInt(numMatch[1], 10) : null
  const maxScore = QUESTION_MAX_SCORES[questionId] ?? null
  const scorePercent =
    numericScore !== null && maxScore !== null && maxScore > 0
      ? Math.round((numericScore / maxScore) * 10000) / 100
      : null
  const isFailing = !isNA && isQuestionFailing(questionId, numericScore)

  return {
    questionId,
    questionLabel,
    rawValue: trimmed,
    numericScore,
    maxScore,
    scorePercent,
    isFailing,
    isNA,
    comment: commentValue?.trim() || null,
  }
}

export function parseAnalyticsQuestion(
  questionId: string,
  questionLabel: string,
  rawValue: string | null | undefined,
  commentValue: string | null | undefined
): QuestionScore {
  const trimmed = (rawValue ?? '').trim()
  const isFailing = /^No/i.test(trimmed)

  return {
    questionId,
    questionLabel,
    rawValue: trimmed,
    numericScore: isFailing ? 0 : 1,
    maxScore: 1,
    scorePercent: isFailing ? 0 : 100,
    isFailing,
    isNA: false,
    comment: commentValue?.trim() || null,
  }
}

/** Synthetic row for general comments (comment-only column). */
export function parseGeneralCommentsOnly(commentRaw: string | null | undefined): QuestionScore | null {
  const text = commentRaw?.trim()
  if (!text) return null
  return {
    questionId: '7.6',
    questionLabel: 'General Comments',
    rawValue: '',
    numericScore: null,
    maxScore: null,
    scorePercent: null,
    isFailing: false,
    isNA: false,
    comment: text,
  }
}

export function detectCSVFormat(headers: string[]): CSVFormat {
  const trimmed = headers.map((h) => h.trim())
  const questionColMatches = trimmed.filter((h) => /^\d+\.\d+:/.test(h)).length
  const hasOldCols =
    trimmed.includes('Section Text') && trimmed.includes('Answer Comment')
  if (questionColMatches >= 2 && !hasOldCols) return 'v5-flat'
  return 'v4-multirow'
}

export function getQuestionLabel(questionId: string): string {
  const def = QUESTION_COLUMNS.find((q) => q.id === questionId)
  if (def) return def.label
  if (questionId === '7.6') return 'General Comments'
  return questionId
}
