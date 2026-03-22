import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '10') || 10))

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
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { weekStart, title, content } = body as { weekStart?: string; title?: string; content?: string }

  if (!weekStart) {
    return badRequest('weekStart is required')
  }

  const plan = await prisma.weeklyPlan.create({
    data: { weekStart, title: title || null, content: content || null },
    include: { todos: true },
  })

  return NextResponse.json(plan, { status: 201 })
}
