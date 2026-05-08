'use client'

import { useRouter } from 'next/navigation'

export type WeekSelectorSnapshot = {
  id: string
  label: string
  report_date: string
}

export function QcReportWeekSelector({
  snapshots,
  value,
}: {
  snapshots: WeekSelectorSnapshot[]
  /** `latest` | `catalog` | snapshot uuid */
  value: string
}) {
  const router = useRouter()

  return (
    <label className="flex flex-col gap-1.5 sm:max-w-md">
      <span className="text-xs font-medium text-text-secondary">Report period</span>
      <select
        className="rounded border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'latest') router.push('/dashboard')
          else if (v === 'catalog') router.push('/dashboard?week=catalog')
          else router.push(`/dashboard?week=${encodeURIComponent(v)}`)
        }}
      >
        <option value="latest">Latest import</option>
        <option value="catalog">Full catalog (all issues)</option>
        {snapshots.length > 0 ? (
          <optgroup label="Saved snapshots">
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {s.report_date}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  )
}
