import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const note = await prisma.note.findUnique({ where: { id } })
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(note)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const body = await request.json()

  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { category: body.category ? body.category.trim().toLowerCase() : null }),
      ...(body.summary !== undefined && { summary: body.summary }),
    },
  })

  return NextResponse.json(note)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  await prisma.note.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
