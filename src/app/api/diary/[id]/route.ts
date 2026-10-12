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

  if (typeof body.content !== 'string') return badRequest('content is required')

  const current = await prisma.diaryEntry.findUnique({ where: { id } })
  if (!current) return notFound('Diary entry not found')
  const conflict = conflictResponse(current, body)
  if (conflict) return conflict

  const content = await normalizeWikiLabels(body.content)
  await snapshotBeforeSave('diary', id, current, content, body)
  const entry = await prisma.diaryEntry.update({ where: { id }, data: { content } })
  return NextResponse.json(entry)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.diaryEntry.delete({ where: { id } })
    await deleteRevisions('diary', id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Diary entry not found')
    }
    throw e
  }
}
