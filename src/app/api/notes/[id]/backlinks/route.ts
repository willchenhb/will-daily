export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, badRequest, notFound } from '@/lib/api-utils'
import { findContent } from '@/lib/content-search'
import { wikiLinkMarker } from '@/lib/wiki'

const MIN_MENTION_LENGTH = 2 // single-character titles would match almost everything

// GET /api/notes/:id/backlinks
//   links:    notes / diary entries / weekly plans containing a [[link]] to this note
//   mentions: ones that mention its title in plain text without linking it
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const note = await prisma.note.findUnique({ where: { id }, select: { title: true } })
  if (!note) return notFound('Note not found')

  const title = note.title.trim()
  const isSelf = (r: { type: string; id: number }) => r.type === 'note' && r.id === id

  const links = (await findContent({ marker: wikiLinkMarker(id), snippetTerms: [title], perType: 50 }))
    .filter(r => !isSelf(r))

  let mentions: typeof links = []
  if (title.length >= MIN_MENTION_LENGTH) {
    const linked = new Set(links.map(r => `${r.type}-${r.id}`))
    mentions = (await findContent({ terms: [title.toLowerCase()], perType: 20 }))
      .filter(r => !isSelf(r) && !linked.has(`${r.type}-${r.id}`))
  }

  return NextResponse.json({ links, mentions })
}
