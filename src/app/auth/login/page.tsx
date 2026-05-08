'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'

type AuthMode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirectTo, setRedirectTo] = useState('/dashboard')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('redirectTo')
    if (p && p.startsWith('/')) setRedirectTo(p)
  }, [])

  useEffect(() => {
    setMsg(null)
  }, [mode])

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

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password !== confirmPassword) {
      setMsg('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setMsg('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      setMsg(error.message)
      return
    }
    if (data.session) {
      router.push(redirectTo)
      router.refresh()
      return
    }
    setMsg(
      'Check your email to confirm your account, then sign in here. If you do not receive a message, confirm that sign-ups are enabled for email in Supabase.'
    )
    setConfirmPassword('')
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

  const heading = mode === 'signin' ? 'Sign in' : 'Create account'
  const sub =
    mode === 'signin'
      ? 'Password or magic link'
      : 'Set a password. You may need to confirm email depending on Supabase settings.'

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded border border-border bg-surface p-8 shadow"
        style={{ borderRadius: 'var(--radius)' }}
      >
        <div
          className="flex rounded border border-border bg-surface-2 p-0.5"
          style={{ borderRadius: 'var(--radius)' }}
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={cn(
              'flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
              mode === 'signin'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
            )}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={cn(
              'flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
              mode === 'signup'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
            )}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
        </div>

        <h1 className="mt-6 text-lg font-semibold text-text">{heading}</h1>
        <p className="mt-1 text-sm text-text-secondary">AVA QC Dashboard — {sub}</p>

        {mode === 'signup' ? (
          <form onSubmit={signUpWithPassword} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email-signup" className="block text-sm font-medium text-text-secondary">
                Email
              </label>
              <input
                id="email-signup"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password-signup" className="block text-sm font-medium text-text-secondary">
                Password
              </label>
              <input
                id="password-signup"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label
                htmlFor="password-signup-confirm"
                className="block text-sm font-medium text-text-secondary"
              >
                Confirm password
              </label>
              <input
                id="password-signup-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-text outline-none focus:border-accent"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        ) : (
          <>
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
          </>
        )}

        {msg && (
          <p
            className={cn(
              'mt-4 text-sm',
              msg.startsWith('Check your email') ? 'text-accent' : 'text-text-secondary'
            )}
          >
            {msg}
          </p>
        )}

        <p className="mt-6 text-xs text-text-muted">
          Admins can still manage users in Supabase under Authentication → Users. Enable &quot;Allow
          new users to sign up&quot; under Authentication → Providers → Email for self-serve signup.
        </p>
      </div>
    </div>
  )
}
