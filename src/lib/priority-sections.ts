import type { Priority } from '@/types/issue'

export const PRIORITY_ORDER: readonly Priority[] = ['p0', 'p1', 'p2', 'p3']

/** Short labels for filter chips */
export const PRIORITY_FILTER_LABEL: Record<Priority, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
}

/** Section headings aligned with QC report groupings */
export const PRIORITY_SECTION_TITLE: Record<Priority, string> = {
  p0: 'P0 — Critical',
  p1: 'P1 — ASR & NLP',
  p2: 'P2 — Script & workflow',
  p3: 'P3 — Transfer & analytics',
}

/** Impact level shown as a chip on expanded cards (v4-style) */
export const PRIORITY_IMPACT_LABEL: Record<Priority, string> = {
  p0: 'Impact: Critical',
  p1: 'Impact: High',
  p2: 'Impact: Medium',
  p3: 'Impact: Lower',
}

export function isPriority(v: string): v is Priority {
  return v === 'p0' || v === 'p1' || v === 'p2' || v === 'p3'
}
