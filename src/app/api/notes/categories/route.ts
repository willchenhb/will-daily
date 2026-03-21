import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const results = await prisma.note.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })

  const categories = results.map(r => r.category).filter(Boolean)
  return NextResponse.json(categories)
}
