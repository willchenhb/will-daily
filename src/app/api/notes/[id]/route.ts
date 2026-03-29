export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const note = await prisma.note.findUnique({ where: { id } })
  if (!note) return notFound('Note not found')
  return NextResponse.json(note)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  try {
    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title as string }),
        ...(body.content !== undefined && { content: body.content as string }),
        ...(body.category !== undefined && { category: body.category ? (body.category as string).trim().toLowerCase() : null }),
        ...(body.summary !== undefined && { summary: body.summary as string }),
      },
    })
    return NextResponse.json(note)
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Note not found')
    }
    throw e
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.note.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Note not found')
    }
    throw e
  }
}
