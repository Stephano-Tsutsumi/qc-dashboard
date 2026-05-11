'use client'

import { useEffect } from 'react'

/**
 * Renders when a Server Component in /dashboard throws (production shows digest in shell only).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard]', error)
  }, [error])

  return (
    <div
      className="mx-auto max-w-lg space-y-4 rounded border border-p0-border bg-p0-bg px-6 py-6 text-p0"
      style={{ borderRadius: 'var(--radius)' }}
    >
      <h1 className="text-lg font-semibold">Dashboard error</h1>
      <p className="text-sm leading-relaxed">
        Something failed while loading this page. Check{' '}
        <strong className="font-medium">Vercel → Deployment → Logs</strong> (filter by function) for
        the stack trace matching digest{' '}
        <code className="mono rounded-sm bg-surface px-1 py-0.5 text-xs">{error.digest ?? '—'}</code>.
      </p>
      {process.env.NODE_ENV === 'development' && error.message ? (
        <pre className="mono max-h-40 overflow-auto rounded-sm border border-border bg-surface p-3 text-xs text-text">
          {error.message}
        </pre>
      ) : null}
      <p className="text-xs leading-relaxed text-text-secondary">
        Common fixes: confirm <code className="mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> are set for{' '}
        <strong>Production</strong> in Vercel, then redeploy. Confirm Supabase redirect URLs include{' '}
        <code className="mono">/auth/callback</code>.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-95"
      >
        Try again
      </button>
    </div>
  )
}
