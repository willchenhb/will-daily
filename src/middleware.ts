import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === 'true'
  if (!authEnabled) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Public routes - always accessible
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg'
  ) {
    return NextResponse.next()
  }

  // Check for session cookie or API token
  const sessionCookie = request.cookies.get('will-daily-session')
  const authHeader = request.headers.get('authorization')

  if (!sessionCookie && !authHeader?.startsWith('Bearer ')) {
    // API requests get 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page requests redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
