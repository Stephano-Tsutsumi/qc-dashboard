import type { Priority } from '@/types/issue'

export type { Priority }

export interface IssueDef {
  id: string
  priority: Priority
  title: string
  description: string
  evidence: {
    qcNotes: Array<{ ref: string; comment: string }>
    recommendedAction: string
  }
}

function defaultEvidence(description: string): IssueDef['evidence'] {
  return {
    qcNotes: [{ ref: 'QC', comment: description }],
    recommendedAction:
      'Validate fixes with targeted regression calls and cross-check analytics against live transcripts.',
  }
}

const SPECIAL: Partial<Record<string, IssueDef['evidence']>> = {
  'p0-fictional-transcript': {
    qcNotes: [
      { ref: '700703866038', comment: 'No input, no output from AVA; silent call artifacts.' },
      {
        ref: '700703866038 — Analytics Summary check',
        comment: 'The summary was not accurate to any captured audio or dialogue.',
      },
    ],
    recommendedAction:
      'Audit pipeline for silent-call handling; block synthetic transcript generation when no valid audio/events exist.',
  },
}

const ISSUE_SEED: Array<[string, Priority, string, string]> = [
  [
    'p0-fictional-transcript',
    'p0',
    'AVA produces no output on live call — generates fictional transcript',
    'One call recorded with zero audio from either party. AVA emitted no greeting, executed no script, then fabricated a complete interaction transcript and analytics summary that never occurred.',
  ],
  [
    'p0-hallucinating',
    'p0',
    'AVA hallucinating mid-call — fabricated responses to user',
    'Reviewer flagged multiple timestamps where AVA generated content unrelated to anything the caller said. Combined with input capture failures and poor barge-in handling in the same call. 11.1% overall score — lowest in dataset.',
  ],
  [
    'p0-flow-failure',
    'p0',
    'Complete flow failure — user unable to reach representative after 6+ minutes',
    "AVA fails to recognize user's repeated denial of self-service and refusal to route to live agent. User spent over six minutes looping before reaching a representative.",
  ],
  [
    'p0-otp-failure',
    'p0',
    'OTP verification failure — AVA does not confirm code match',
    'Reviewer found AVA does not verify that the OTP entered matches the sent code, creating a security gap.',
  ],
  [
    'p1-phone-capture',
    'p1',
    'Phone number capture fails — exceeds retry limit, no fallback',
    "Multiple calls flagged where AVA fails to correctly capture the user's phone number, exceeds allowed attempts, and does not offer callback or graceful transfer.",
  ],
  [
    'p1-fast-speech',
    'p1',
    'Fast speech / heavy accent causes capture failures across multiple calls',
    'Reviewers consistently flagged calls where fast-talking callers, slurred speech, regional accents, or background noise caused AVA to miss or misinterpret first utterances.',
  ],
  [
    'p1-agent-misrouted',
    'p1',
    '"Agent" utterance misrouted — AVA fails caller-type identification',
    `Multiple calls where a broker/agent caller states "I'm an agent" but AVA fails to classify them correctly and treats them as a member.`,
  ],
  [
    'p1-barge-in',
    'p1',
    'First utterance truncated — barge-in window too short',
    'Reviewers noted AVA cuts off callers before they finish their first utterance. Only partial phrases captured.',
  ],
  [
    'p1-multi-word',
    'p1',
    'Multi-word / compound input misread (e.g. "RV" hallucinated)',
    'Reviewer flagged an instance where AVA interpreted a word the user never said ("RV") and pivoted the conversation to RV-related content.',
  ],
  [
    'p1-reinstatement',
    'p1',
    'Reinstatement flow fails when phone number linked to multiple accounts',
    "AVA did not complete the reinstatement flow when the caller's phone number was linked to more than one account. No disambiguation or fallback offered.",
  ],
  [
    'p1-call-topics',
    'p1',
    'Call Topics and Summary inaccurate — does not reflect actual interaction',
    'Reviewers flagged 59+ instances where "Call Topics" listed in analytics did not match the actual content of the call.',
  ],
  [
    'p1-transcription',
    'p1',
    'Transcription accuracy — speech cut off at start of call',
    '71 instances where transcription is missing or truncated at the beginning of the call.',
  ],
  [
    'p1-cancel-intent',
    'p1',
    'AVA misidentifies "cancel" intent — proceeds without verification',
    'AVA interpreted an ambiguous utterance as cancellation intent and proceeded to the cancellation flow without proper confirmation.',
  ],
  [
    'p1-no-capture',
    'p1',
    'AVA fails to capture "No" — loops instead of escalating',
    'Multiple calls where the user clearly says "No" to self-service options but AVA does not register it, leading to repeated loops.',
  ],
  [
    'p2-grammar-script',
    'p2',
    'Grammatical error in callback permission script — flagged 3+ times',
    'Reviewers flagged improper grammar in the script used when AVA asks callback permission before transferring.',
  ],
  [
    'p2-transfer-reason',
    'p2',
    'AVA does not explain transfer reason — caller left without context',
    'Multiple calls where AVA transfers the caller without explaining why the transfer is happening.',
  ],
  [
    'p2-task-confirm',
    'p2',
    'AVA does not confirm task completion or offer additional help at call end',
    "Reviewers noted AVA frequently ends calls without confirming what was completed or asking if there's anything else the caller needs.",
  ],
  [
    'p2-empathy',
    'p2',
    'Inappropriate empathy response — tone mismatch on sensitive topics',
    "Calls flagged where AVA's empathy responses did not match the situation's emotional weight. Scripted empathy phrases are generic and poorly timed.",
  ],
  [
    'p2-clarification',
    'p2',
    'No clarification requested on ambiguous intents — AVA guesses instead',
    'When caller intent is unclear, AVA proceeds with its best guess rather than requesting clarification.',
  ],
  [
    'p2-plan-info',
    'p2',
    'AVA reads back incorrect plan information to caller',
    'Call flagged where AVA provided incorrect plan details or read back information from the wrong account.',
  ],
  [
    'p2-ooscope',
    'p2',
    'Out-of-scope handling overly broad — AVA drops valid requests',
    'Out-of-scope task handling had an 86.7% zero-score rate — the highest failure rate of any section.',
  ],
  [
    'p2-workflow-order',
    'p2',
    'AVA workflow navigation order incorrect in multi-step flows',
    'Reviewer noted AVA did not follow the intended workflow order — steps were executed out of sequence.',
  ],
  [
    'p3-transfer-context',
    'p3',
    'Transfer path drops context — live agent receives no call summary',
    'When AVA transfers to a live agent, the agent receives no screen-pop or summary of what was discussed.',
  ],
  [
    'p3-transfer-category',
    'p3',
    'System-driven vs. user-requested transfer not correctly categorized',
    '98 instances flagged where transfer classification logic is inconsistently applied.',
  ],
  [
    'p3-no-callback',
    'p3',
    'No callback offer after max capture failures',
    'When AVA fails to capture data after multiple attempts, the system either loops indefinitely or transfers without offering a callback.',
  ],
  [
    'p3-reauth',
    'p3',
    'AVA re-authenticates mid-call unnecessarily',
    'Authentication section had the second-highest zero-score rate (63.3%). Reviewer flagged a case where AVA attempted a repeat authentication prompt before the first attempt had resolved.',
  ],
  [
    'p3-spanish-nlp',
    'p3',
    'Spanish-language intent handling undertrained — bilingual callers misrouted',
    'Multiple Spanish-speaking callers were misrouted due to NLP model not handling regional Spanish vocabulary.',
  ],
  [
    'p3-containment',
    'p3',
    'Containment rate inflated — escalations not tracked correctly',
    "Unnecessary escalations are being counted as containment failures when they're actually system failures.",
  ],
  [
    'p3-dev-analysis',
    'p3',
    'AVA Development Specific Analysis — 100% zero score',
    'Every single response in the "AVA Development Specific Analysis" section scored zero across 896 questions.',
  ],
  [
    'p3-duration-outliers',
    'p3',
    'Call duration outliers — some calls exceed 20+ minutes for simple flows',
    'A subset of calls show extreme durations (20–44 minutes) for tasks that should take 2–4 minutes.',
  ],
  [
    'p3-analytics-quality',
    'p3',
    'Call-QA Analytics & Transcription — 91.2% zero score rate',
    'Analytics and transcription quality section failed in 91.2% of questions.',
  ],
  [
    'p3-max-retry',
    'p3',
    'No max-retry limit across flows — calls loop indefinitely',
    'The current design lacks consistent global retry limits across all flows.',
  ],
]

export const ALL_ISSUES: IssueDef[] = ISSUE_SEED.map(([id, priority, title, description]) => ({
  id,
  priority,
  title,
  description,
  evidence: SPECIAL[id] ?? defaultEvidence(description),
}))

export const ISSUE_BY_ID = Object.fromEntries(ALL_ISSUES.map((i) => [i.id, i])) as Record<
  string,
  IssueDef
>
