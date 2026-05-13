'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

export type SectionPerformanceSection = { section: string; scorePercent: number }

function barColor(pct: number): string {
  if (pct < 50) return '#e24b4a'
  if (pct < 75) return '#ef9f27'
  return '#378add'
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 text-text-muted transition-transform duration-200',
        expanded && 'rotate-180'
      )}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 8l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function SectionPerformanceChart({ sections }: { sections: SectionPerformanceSection[] }) {
  const panelId = useId()
  const [expanded, setExpanded] = useState(false)

  if (!sections.length) return null
  const sorted = [...sections].sort((a, b) => a.scorePercent - b.scorePercent)

  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Section performance
          </h2>
          {!expanded ? (
            <p className="mt-1 text-xs text-text-secondary">
              {sorted.length} row{sorted.length === 1 ? '' : 's'} · expand to view all
            </p>
          ) : null}
        </div>
        <Chevron expanded={expanded} />
      </button>

      <div id={panelId} role="region" aria-label="Section performance details" hidden={!expanded}>
        {expanded ? (
          <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
            {sorted.map((s) => (
              <div key={s.section}>
                <div className="mb-1 flex justify-between text-xs text-text-secondary">
                  <span className="min-w-0 truncate pr-2 font-medium">{s.section}</span>
                  <span
                    className="tabular-nums shrink-0"
                    style={{ color: s.scorePercent < 75 ? '#854f0b' : undefined }}
                  >
                    {s.scorePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-surface-2">
                  <div
                    className="h-full rounded transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, s.scorePercent))}%`,
                      background: barColor(s.scorePercent),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
