'use client'

function BoldParts({ text }: { text: string }) {
  const parts = text.split(/\*\*/)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-text">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

export function ChangelogBanner({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div
      className="rounded-[var(--radius)] border border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-sky-50 px-4 py-3 dark:border-emerald-800/60 dark:from-emerald-950/40 dark:to-sky-950/30"
      role="status"
    >
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        Updated from new scorecard CSV structure
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/90">
        {items.map((item, i) => (
          <li key={i}>
            <BoldParts text={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}
