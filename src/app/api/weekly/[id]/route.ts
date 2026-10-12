export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'
import { normalizeWikiLabels } from '@/lib/wiki-sync'
import { conflictResponse, deleteRevisions, snapshotBeforeSave } from '@/lib/revisions'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const current = await prisma.weeklyPlan.findUnique({ where: { id } })
  if (!current) return notFound('Weekly plan not found')
  const conflict = conflictResponse(current, body)
  if (conflict) return conflict

  const content = typeof body.content === 'string' ? await normalizeWikiLabels(body.content) : undefined
  await snapshotBeforeSave('weekly', id, current, content, body)

  const plan = await prisma.weeklyPlan.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title as string }),
      ...(content !== undefined && { content }),
    },
    include: { todos: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(plan)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.weeklyPlan.delete({ where: { id } })
    await deleteRevisions('weekly', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Weekly plan not found')
    }
    throw e
  }
}
