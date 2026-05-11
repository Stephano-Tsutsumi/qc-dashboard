import { getSupabasePublicEnvOrNull } from '@/lib/supabase-env'
import { createMiddlewareClient } from '@/utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CONFIG_HELP = `Configuration error: Supabase environment variables are missing or empty.

In Vercel: Project → Settings → Environment Variables (for Production + Preview), add:
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key

(Optional legacy name: NEXT_PUBLIC_SUPABASE_ANON_KEY)

Also set NEXT_PUBLIC_APP_URL to your site URL (e.g. https://your-app.vercel.app) for auth redirects.

Save, then redeploy.`

export async function middleware(request: NextRequest) {
  const pub = getSupabasePublicEnvOrNull()
  const { pathname } = request.nextUrl

  if (!pub) {
    const needsAuth =
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/auth/')
    if (needsAuth) {
      return new NextResponse(CONFIG_HELP, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
    return NextResponse.next()
  }

  const { supabase, response } = createMiddlewareClient(request, pub)
  // Use getUser(), not getSession() — session is often empty in Edge even when cookies are valid.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!user && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/auth/:path*', '/api/:path*'],
}
