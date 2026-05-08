'use client'

import type { IssueStatus } from '@/types/issue'
import { normalizeIssueStatus } from '@/types/issue'

const STATUS_STYLES: Record<IssueStatus, string> = {
  open: 'bg-amber-100 text-amber-900 border-amber-300/80',
  'in-progress': 'bg-blue-100 text-blue-900 border-blue-300/80',
  resolved: 'bg-emerald-100 text-emerald-900 border-emerald-300/80',
  blocked: 'bg-red-100 text-red-900 border-red-300/80',
}

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  resolved: 'Resolved',
  blocked: 'Blocked',
}

export interface StatusPillProps {
  status: string | null | undefined
}

export function StatusPill({ status }: StatusPillProps) {
  const s = normalizeIssueStatus(status)
  const label = STATUS_LABEL[s]
  const styles = STATUS_STYLES[s]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  )
}
