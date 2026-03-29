import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const SESSION_COOKIE = 'will-daily-session'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function getDb() {
  const envUrl = process.env.DATABASE_URL
  let dbPath: string
  if (envUrl && envUrl.startsWith('file:')) {
    dbPath = path.resolve(process.cwd(), envUrl.replace('file:', ''))
  } else {
    dbPath = path.resolve(process.cwd(), 'data', 'daily.db')
  }
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return new Database(dbPath)
}

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

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE,
  path: '/',
}

export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000

  // Store in SQLite directly (Prisma doesn't have Session model)
  const db = getDb()
  db.prepare('INSERT INTO Session (token, userId, expiresAt) VALUES (?, ?, ?)').run(token, userId, expiresAt)
  db.close()

  return token
}

export async function getSession(): Promise<{ userId: number } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const db = getDb()
  const row = db.prepare('SELECT userId, expiresAt FROM Session WHERE token = ?').get(token) as { userId: number; expiresAt: number } | undefined
  if (row && row.expiresAt > Date.now()) {
    db.close()
    return { userId: row.userId }
  }
  // Expired or not found — clean up
  if (row) db.prepare('DELETE FROM Session WHERE token = ?').run(token)
  db.close()
  return null
}

export async function clearSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    const db = getDb()
    db.prepare('DELETE FROM Session WHERE token = ?').run(token)
    db.close()
  }
  return token ?? null
}

// Get current user from session cookie or API token header
export async function getCurrentUser(request?: Request) {
  const authEnabled = process.env.AUTH_ENABLED === 'true'
  if (!authEnabled) return null

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
