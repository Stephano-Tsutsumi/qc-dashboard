import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv } from '@/lib/supabase-env'

type CookieStore = ReturnType<typeof cookies>

export function createClient(cookieStore: CookieStore) {
  const { url, anonKey } = getSupabasePublicEnv()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          /* Called from a Server Component — middleware refreshes session */
        }
      },
    },
  })
}

/** Service role — server-only; never import in client code. */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key?.trim()) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (only needed for admin/server bypass operations).'
    )
  }
  return createSupabaseJsClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
