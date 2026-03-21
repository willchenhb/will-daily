import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authEnabled = process.env.AUTH_ENABLED === 'true'
  if (!authEnabled) {
    return NextResponse.next()
  }
  // TODO: Implement NextAuth.js authentication check
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
