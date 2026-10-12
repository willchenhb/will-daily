export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

// PUT /api/notes/:id/pin { pinned: boolean } — add to / remove from 收藏.
// Raw SQL so updatedAt stays put: bookmarking is not an edit, and bumping it would make
// the open note's next autosave look like an edit conflict.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')
  const body = await parseBody(request)
  if (!body || typeof body.pinned !== 'boolean') return badRequest('pinned (boolean) is required')

  // Same text format Prisma's SQLite adapter writes for DateTime columns
  const pinnedAt = body.pinned ? new Date().toISOString().replace('Z', '+00:00') : null
  const changed = await prisma.$executeRaw`UPDATE Note SET pinnedAt = ${pinnedAt} WHERE id = ${id}`
  if (changed === 0) return notFound('Note not found')
  return NextResponse.json({ pinned: body.pinned })
}
