export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const weeklyPlanId = parseId(params.id)
  if (weeklyPlanId === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const maxOrder = await prisma.todoItem.findFirst({
    where: { weeklyPlanId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const todo = await prisma.todoItem.create({
    data: {
      weeklyPlanId,
      text: body.text as string,
      order: (maxOrder?.order ?? -1) + 1,
    },
  })

  return NextResponse.json(todo, { status: 201 })
}
