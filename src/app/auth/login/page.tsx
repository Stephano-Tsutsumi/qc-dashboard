'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const DEFAULT_EMAIL = 'tsutsumi21s@gmail.com'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/dashboard')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('redirectTo')
    if (p && p.startsWith('/')) setRedirectTo(p)
  }, [])

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMsg(error.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  async function sendMagicLink(e: React.FormEvent) {
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
        <p className="mt-1 text-sm text-text-secondary">
          AVA QC Dashboard — password or magic link
        </p>

        <form onSubmit={signInWithPassword} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
              autoComplete="current-password"
              placeholder="Your Supabase user password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in with password'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-2 text-text-muted">or</span>
          </div>
        </div>

        <form onSubmit={sendMagicLink}>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface disabled:opacity-50"
          >
            {loading ? 'Working…' : 'Email me a magic link'}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-text-secondary">{msg}</p>}

        <p className="mt-6 text-xs text-text-muted">
          First time? In Supabase: Authentication → Users → Add user → use this email and set a
          password, or enable sign-ups under Providers → Email.
        </p>
      </div>
    </div>
  )
}
