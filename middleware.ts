import { createMiddlewareClient } from '@/utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  if (!session && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!session && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*', '/api/:path*'],
}
