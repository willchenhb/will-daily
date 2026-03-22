import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  const todoId = parseId(params.todoId)
  if (todoId === null) return badRequest('Invalid todoId')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  try {
    const todo = await prisma.todoItem.update({
      where: { id: todoId },
      data: {
        ...(body.text !== undefined && { text: body.text as string }),
        ...(body.completed !== undefined && { completed: body.completed as boolean }),
        ...(body.note !== undefined && { note: body.note as string }),
        ...(body.order !== undefined && { order: body.order as number }),
      },
    })
    return NextResponse.json(todo)
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Todo item not found')
    }
    throw e
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  const todoId = parseId(params.todoId)
  if (todoId === null) return badRequest('Invalid todoId')

  try {
    await prisma.todoItem.delete({ where: { id: todoId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Todo item not found')
    }
    throw e
  }
}
