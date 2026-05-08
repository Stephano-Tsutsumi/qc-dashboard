import type { ReviewerNote } from '@/types/csv'

export type IssueNoteRule = {
  sections?: string[]
  keywords?: string[]
  failureOnly?: boolean
}

/** Maps each catalog issue to CSV section/keyword rules (see csv_logic_prompt.rtf). */
export const ISSUE_NOTE_RULES: Record<string, IssueNoteRule> = {
  'p0-fictional-transcript': {
    keywords: [
      'fictional',
      'fabricat',
      'no input',
      'no output',
      'no audio',
      'no speaking',
      'no greeting',
    ],
    failureOnly: true,
  },
  'p0-hallucinating': {
    keywords: ['hallucin', 'unrelated', 'never stated', 'made up', 'fabricated content'],
    failureOnly: true,
  },
  'p0-flow-failure': {
    keywords: [
      'six minutes',
      'loop',
      'unable to reach',
      'denial',
      'refused',
      'representative',
    ],
    failureOnly: true,
  },
  'p0-otp-failure': {
    sections: ['authentication'],
    keywords: ['otp', 'verification', 'code', 'repeated authentication'],
    failureOnly: true,
  },
  'p1-phone-capture': {
    sections: ['natural language'],
    keywords: [
      'phone number',
      'callback',
      'retry',
      'ask.*twice',
      'capture.*number',
      'number.*capture',
    ],
    failureOnly: true,
  },
  'p1-fast-speech': {
    sections: ['natural language'],
    keywords: ['fast', 'accent', 'mumbl', 'background noise', 'slur', 'low quality audio'],
    failureOnly: true,
  },
  'p1-agent-misrouted': {
    keywords: ["i'm an agent", 'agent', 'broker', 'representative', 'talk to somebody'],
    failureOnly: true,
  },
  'p1-barge-in': {
    sections: ['natural language'],
    keywords: ['barge', 'cut off', 'response slot', 'longer response', 'truncat'],
    failureOnly: true,
  },
  'p1-multi-word': {
    keywords: ['rv', 'never stated', 'misread', 'compound'],
    failureOnly: true,
  },
  'p1-reinstatement': {
    keywords: ['reinstate', 'multiple account', 'linked to more'],
    failureOnly: true,
  },
  'p1-call-topics': {
    sections: ['analytics', 'transcription'],
    keywords: ['call topic', 'topic', 'missing', 'transfer to representative'],
    failureOnly: true,
  },
  'p1-transcription': {
    sections: ['analytics', 'transcription'],
    keywords: ['transcri', 'cut off', 'speech.*cut', 'beginning'],
    failureOnly: true,
  },
  'p1-cancel-intent': {
    keywords: ['cancel', 'coverage', 'without.*confirm', 'understand you.*cancel'],
    failureOnly: true,
  },
  'p1-no-capture': {
    sections: ['natural language'],
    keywords: ['word no', 'capture.*no', 'denial', 'negative', '"no"', "'no'"],
    failureOnly: true,
  },
  'p2-grammar-script': {
    keywords: ['grammar', 'improper grammar', 'callback permission', 'grammatical'],
  },
  'p2-transfer-reason': {
    sections: ['transfer'],
    keywords: ['why.*transfer', 'advise.*transfer', 'explain.*transfer', 'without.*reason'],
    failureOnly: true,
  },
  'p2-task-confirm': {
    sections: ['task completion'],
    keywords: ['confirm.*complet', 'additional assist', 'offer.*help', 'did not confirm'],
    failureOnly: true,
  },
  'p2-empathy': {
    sections: ['user experience'],
    keywords: ['empathy', 'tone', 'frustrat', 'inappropriate response'],
    failureOnly: true,
  },
  'p2-clarification': {
    sections: ['natural language'],
    keywords: ['clarif', 'ambiguous', 'guess', 'assumption'],
    failureOnly: true,
  },
  'p2-plan-info': {
    keywords: ['plan', 'incorrect.*plan', 'wrong.*plan', 'plan.*incorrect'],
    failureOnly: true,
  },
  'p2-ooscope': {
    sections: ['out-of-scope'],
    failureOnly: true,
  },
  'p2-workflow-order': {
    sections: ['task completion'],
    keywords: ['workflow', 'order', 'sequence', 'out of order'],
    failureOnly: true,
  },
  'p3-transfer-context': {
    sections: ['transfer'],
    keywords: ['context', 'summary', 'screen.?pop', 'repeat.*issue', 'start over'],
    failureOnly: true,
  },
  'p3-transfer-category': {
    sections: ['transfer'],
    keywords: ['system.?driven', 'user.?request', 'classif', 'categor'],
    failureOnly: true,
  },
  'p3-no-callback': {
    keywords: ['call.*back', 'callback', 'offer.*callback'],
    failureOnly: true,
  },
  'p3-reauth': {
    sections: ['authentication'],
    keywords: ['re.?auth', 'repeated.*auth', 'again', 'unnecessary'],
    failureOnly: true,
  },
  'p3-spanish-nlp': {
    keywords: ['spanish', 'agente', 'bilingual', 'regional', 'slang', 'us spanish'],
    failureOnly: true,
  },
  'p3-containment': {
    keywords: ['containment', 'call load', 'inflat'],
  },
  'p3-dev-analysis': {
    sections: ['ava development'],
    failureOnly: true,
  },
  'p3-duration-outliers': {
    keywords: ['minute', 'duration', 'long.*call', 'over.*minute'],
    failureOnly: true,
  },
  'p3-analytics-quality': {
    sections: ['analytics', 'transcription'],
    failureOnly: true,
  },
  'p3-max-retry': {
    keywords: ['retry', 'loop', 'max.*attempt', 'indefinitely'],
    failureOnly: true,
  },
}

function matchesKeyword(pattern: string, note: ReviewerNote): boolean {
  const haystacks = [note.comment, note.question, note.answer, note.section].join('\n')
  const hay = haystacks.toLowerCase()
  const p = pattern.trim()
  if (!p) return false
  const needsRegex =
    /\.\*|\.\?|\(\?[:=]/.test(p) || (p.includes('?') && p.includes('.'))
  if (needsRegex) {
    try {
      return new RegExp(p, 'i').test(hay)
    } catch {
      return hay.includes(p.toLowerCase())
    }
  }
  return hay.includes(p.toLowerCase())
}

/**
 * All reviewer-note rows matching an issue's rules (dedupe refs for breakdown elsewhere).
 */
export function filterNotesForIssue(issueId: string, reviewerNotes: ReviewerNote[]): ReviewerNote[] {
  const rule = ISSUE_NOTE_RULES[issueId]
  if (!rule) return []

  const sectionLower = (s: string) => s.toLowerCase()

  return reviewerNotes.filter((note) => {
    const sectionMatch =
      !rule.sections?.length ||
      rule.sections.some((s) => sectionLower(note.section).includes(s.toLowerCase()))

    const keywordMatch =
      !rule.keywords?.length || rule.keywords.some((k) => matchesKeyword(k, note))

    const failureOk = rule.failureOnly ? note.questionPct === 0 : true

    return sectionMatch && keywordMatch && failureOk
  })
}

/**
 * QC reviewer-note rows from the CSV matched to one catalog issue (rule-based).
 */
export function getNotesForIssue(
  issueId: string,
  reviewerNotes: ReviewerNote[],
  maxNotes = 3
): ReviewerNote[] {
  return filterNotesForIssue(issueId, reviewerNotes).slice(0, maxNotes)
}
