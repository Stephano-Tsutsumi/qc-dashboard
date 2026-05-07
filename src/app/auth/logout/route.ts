import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient(cookies())
  await supabase.auth.signOut()
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/auth/login`, { status: 302 })
}
