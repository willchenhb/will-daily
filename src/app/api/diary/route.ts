import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
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
  const body = await request.json()
  const { date, content } = body

  if (!date || !content) {
    return NextResponse.json({ error: 'date and content are required' }, { status: 400 })
  }

  const entry = await prisma.diaryEntry.create({
    data: { date, content },
  })

  return NextResponse.json(entry, { status: 201 })
}
