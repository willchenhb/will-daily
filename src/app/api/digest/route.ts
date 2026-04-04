export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/digest?date=2026-04-04
// Returns today's digest grouped by category
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
    || new Date().toISOString().slice(0, 10)

  const items = await prisma.dailyDigest.findMany({
    where: { date },
    orderBy: { createdAt: 'desc' },
  })

  // Group by category
  const grouped: Record<string, typeof items> = {}
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }

  return NextResponse.json({ date, items, grouped })
}
