export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest } from '@/lib/api-utils'

const DATE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/diary/dates?from=YYYY-MM-DD&to=YYYY-MM-DD → { dates } that have a diary
// entry or chat summary (for the calendar)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  if (!DATE.test(from) || !DATE.test(to)) return badRequest('from and to (YYYY-MM-DD) are required')

  const rows = await prisma.diaryEntry.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'asc' },
  })
  return NextResponse.json({ dates: rows.map(r => r.date) })
}
