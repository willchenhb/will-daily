import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20') || 20))
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (from || to) {
    where.date = {}
    if (from) (where.date as Record<string, string>).gte = from
    if (to) (where.date as Record<string, string>).lte = to
  }

  const [entries, total] = await Promise.all([
    prisma.diaryEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.diaryEntry.count({ where }),
  ])

  return NextResponse.json({ entries, total, page, size })
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { date, content } = body as { date?: string; content?: string }

  if (!date || !content) {
    return badRequest('date and content are required')
  }

  const entry = await prisma.diaryEntry.create({
    data: { date, content },
  })

  return NextResponse.json(entry, { status: 201 })
}
