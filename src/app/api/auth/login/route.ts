export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { username, password } = body as { username?: string; password?: string }
  if (!username || !password) {
    return badRequest('username and password are required')
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSession(user.id)

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  })
  response.cookies.set('will-daily-session', token, SESSION_COOKIE_OPTIONS)
  return response
}
