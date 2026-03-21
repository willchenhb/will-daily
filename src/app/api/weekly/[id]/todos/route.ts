import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const weeklyPlanId = parseInt(params.id)
  const body = await request.json()

  const maxOrder = await prisma.todoItem.findFirst({
    where: { weeklyPlanId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const todo = await prisma.todoItem.create({
    data: {
      weeklyPlanId,
      text: body.text,
      order: (maxOrder?.order ?? -1) + 1,
    },
  })

  return NextResponse.json(todo, { status: 201 })
}
