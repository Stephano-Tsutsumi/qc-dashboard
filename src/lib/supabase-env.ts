/**
 * Public Supabase config (safe for browser + Edge). Validates env for clearer deploy failures.
 */
export type SupabasePublicEnv = {
  url: string
  anonKey: string
}

export function getSupabasePublicEnvOrNull(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const cfg = getSupabasePublicEnvOrNull()
  if (!cfg) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY). Add them in Vercel → Settings → Environment Variables, then redeploy.'
    )
  }
  return cfg
}
