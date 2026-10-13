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

// Reorder: body { ids } lists every todo of this plan in the new order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const weeklyPlanId = parseId(params.id)
  if (weeklyPlanId === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  const ids = body?.ids
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) return badRequest('ids must be an array of todo ids')

  // Must be exactly this plan's todos; otherwise the list changed elsewhere since it was loaded
  const current = await prisma.todoItem.findMany({ where: { weeklyPlanId }, select: { id: true } })
  const wanted = new Set<number>(ids)
  if (wanted.size !== ids.length || current.length !== ids.length || !current.every(t => wanted.has(t.id))) {
    return NextResponse.json({ error: 'Todo list changed, reload and try again' }, { status: 409 })
  }

  await prisma.$transaction(
    (ids as number[]).map((id, order) => prisma.todoItem.update({ where: { id }, data: { order } })),
  )
  return NextResponse.json({ ok: true })
}
