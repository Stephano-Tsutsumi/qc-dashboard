'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    const supabase = createClient()
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('Check your email for the magic link.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded border border-border bg-surface p-8 shadow"
        style={{ borderRadius: 'var(--radius)' }}
      >
        <h1 className="text-lg font-semibold text-text">Sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">AVA QC Dashboard — magic link</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {loading ? 'Sending link…' : 'Send magic link'}
          </button>
        </form>
        {msg && <p className="mt-4 text-sm text-text-secondary">{msg}</p>}
      </div>
    </div>
  )
}
