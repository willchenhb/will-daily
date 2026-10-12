// Version history and edit-conflict detection for autosaved documents
// (notes, diary entries, weekly plans).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { htmlToText, isEmptyHtml } from '@/lib/html'
import type { DocType } from '@/lib/revisions-types'

export type { DocType }

const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000 // at most one routine snapshot per 10 minutes
const MAX_REVISIONS = 50 // per document
const BIG_DELETE_MIN_CHARS = 200
const BIG_DELETE_RATIO = 0.5 // losing over half the text always snapshots

interface SaveFlags {
  // updatedAt of the version the client was editing
  baseUpdatedAt?: unknown
  // Overwrite even if the document changed elsewhere
  force?: unknown
  // Always keep the version being replaced (restores, forced overwrites)
  snapshot?: unknown
}

// 409 when the client edited an older version than the one stored
export function conflictResponse<T extends { updatedAt: Date }>(current: T, flags: SaveFlags): NextResponse | null {
  if (flags.force === true || typeof flags.baseUpdatedAt !== 'string') return null
  if (flags.baseUpdatedAt === current.updatedAt.toISOString()) return null
  return NextResponse.json({ error: 'conflict', current }, { status: 409 })
}

// Call before overwriting a document: keeps the version being replaced when the last
// snapshot is old, the edit deletes a lot, or the client asked for it.
export async function snapshotBeforeSave(
  type: DocType,
  id: number,
  previous: { title?: string | null; content: string | null },
  nextContent: string | undefined,
  flags: SaveFlags,
): Promise<void> {
  const prevContent = previous.content
  if (!prevContent || isEmptyHtml(prevContent) || nextContent === undefined || nextContent === prevContent) return

  const last = await prisma.revision.findFirst({
    where: { sourceType: type, sourceId: id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, content: true },
  })
  if (last?.content === prevContent) return

  const prevChars = htmlToText(prevContent).length
  const bigDelete = prevChars >= BIG_DELETE_MIN_CHARS && htmlToText(nextContent).length < prevChars * BIG_DELETE_RATIO
  const stale = !last || Date.now() - last.createdAt.getTime() > SNAPSHOT_INTERVAL_MS
  if (!stale && !bigDelete && flags.snapshot !== true && flags.force !== true) return

  await addRevision(type, id, previous.title ?? null, prevContent)
}

// Store a version and prune the oldest beyond MAX_REVISIONS
export async function addRevision(type: DocType, id: number, title: string | null, content: string): Promise<void> {
  await prisma.revision.create({ data: { sourceType: type, sourceId: id, title, content } })

  const old = await prisma.revision.findMany({
    where: { sourceType: type, sourceId: id },
    orderBy: { createdAt: 'desc' },
    skip: MAX_REVISIONS,
    select: { id: true },
  })
  if (old.length) await prisma.revision.deleteMany({ where: { id: { in: old.map(r => r.id) } } })
}

export async function deleteRevisions(type: DocType, id: number): Promise<void> {
  await prisma.revision.deleteMany({ where: { sourceType: type, sourceId: id } })
}
