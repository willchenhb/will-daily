export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeWikiLabels, propagateNoteTitle } from '@/lib/wiki-sync'
import { conflictResponse, deleteRevisions, snapshotBeforeSave } from '@/lib/revisions'
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

  const current = await prisma.note.findUnique({ where: { id } })
  if (!current) return notFound('Note not found')
  const conflict = conflictResponse(current, body)
  if (conflict) return conflict

  const content = typeof body.content === 'string' ? await normalizeWikiLabels(body.content) : undefined
  await snapshotBeforeSave('note', id, current, content, body)

  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title as string }),
      ...(content !== undefined && { content }),
      ...(body.category !== undefined && { category: body.category ? (body.category as string).trim().toLowerCase() : null }),
      ...(body.summary !== undefined && { summary: body.summary as string }),
    },
  })
  if (current.title !== note.title) await propagateNoteTitle(id, note.title)
  return NextResponse.json(note)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.note.delete({ where: { id } })
    await deleteRevisions('note', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Note not found')
    }
    throw e
  }
}
