'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  return (
    <div className="flex items-center gap-3 text-sm">
      {email && <span className="text-text-muted">{email}</span>}
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-sm border border-border px-3 py-1.5 text-text-secondary hover:bg-surface-2"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
