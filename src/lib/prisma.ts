import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbPath(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && envUrl.startsWith('file:')) {
    const filePath = envUrl.replace('file:', '')
    return path.resolve(process.cwd(), filePath)
  }
  return path.resolve(process.cwd(), 'data', 'daily.db')
}

function createPrismaClient() {
  const dbPath = getDbPath()

  // Set WAL mode and busy timeout for better concurrency
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.close()

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
