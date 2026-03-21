import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '10')

  const [plans, total] = await Promise.all([
    prisma.weeklyPlan.findMany({
      orderBy: { weekStart: 'desc' },
      include: { todos: { orderBy: { order: 'asc' } } },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.weeklyPlan.count(),
  ])

  return NextResponse.json({ plans, total, page, size })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { weekStart, title, content } = body

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
  }

  const plan = await prisma.weeklyPlan.create({
    data: { weekStart, title, content },
    include: { todos: true },
  })

  return NextResponse.json(plan, { status: 201 })
}
