import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  const todoId = parseInt(params.todoId)
  const body = await request.json()

  const todo = await prisma.todoItem.update({
    where: { id: todoId },
    data: {
      ...(body.text !== undefined && { text: body.text }),
      ...(body.completed !== undefined && { completed: body.completed }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.order !== undefined && { order: body.order }),
    },
  })

  return NextResponse.json(todo)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; todoId: string } }
) {
  const todoId = parseInt(params.todoId)
  await prisma.todoItem.delete({ where: { id: todoId } })
  return NextResponse.json({ ok: true })
}
