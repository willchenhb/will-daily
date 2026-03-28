import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SESSION_COOKIE = 'will-daily-session'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

// Simple in-memory session store: token -> userId
// Production should use Redis or database
const sessions = new Map<string, { userId: number; expiresAt: number }>()

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateApiToken(): string {
  return crypto.randomUUID()
}

export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken()
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return token
}

export async function getSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    const session = sessions.get(token)
    if (session && session.expiresAt > Date.now()) {
      return { userId: session.userId }
    }
    sessions.delete(token) // expired
  }
  return null
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    sessions.delete(token)
  }
  cookieStore.delete(SESSION_COOKIE)
}

// Get current user from session cookie or API token header
export async function getCurrentUser(request?: Request) {
  const authEnabled = process.env.AUTH_ENABLED === 'true'
  if (!authEnabled) return null // Auth disabled, skip

  // Check Bearer token (API access)
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const apiToken = authHeader.slice(7)
      const user = await prisma.user.findUnique({ where: { apiToken } })
      if (user && user.isActive) {
        return { id: user.id, username: user.username, role: user.role }
      }
    }
  }

  // Check session cookie
  const session = await getSession()
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (user && user.isActive) {
      return { id: user.id, username: user.username, role: user.role }
    }
  }

  return null
}

export function isAdmin(user: { role: string } | null): boolean {
  return user?.role === 'admin'
}
