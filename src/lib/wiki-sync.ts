import { prisma } from '@/lib/prisma'
import { renameWikiLinks, wikiLinkMarker } from '@/lib/wiki'

// Documents that can hold [[links]] (fixed list: table names are interpolated below)
const TABLES = ['Note', 'DiaryEntry', 'WeeklyPlan'] as const
const MAX_ATTEMPTS = 3

// Rewrite the label of every [[link]] to a renamed note, so links read the new title
// and full-text search finds them by it.
// Raw SQL on purpose: this is not an edit of those documents, so their updatedAt (used
// for ordering and edit-conflict detection) must not change. Each write is a
// compare-and-swap on the content that was read, so an autosave landing in between is
// never overwritten; the row is re-read and retried instead.
export async function propagateNoteTitle(noteId: number, title: string): Promise<void> {
  const marker = `%${wikiLinkMarker(noteId)}%`
  for (const table of TABLES) {
    const rows = await prisma.$queryRawUnsafe<{ id: number; content: string | null }[]>(
      `SELECT id, content FROM ${table} WHERE content LIKE ?`, marker,
    )
    for (const row of rows) {
      let content = row.content
      for (let attempt = 0; attempt < MAX_ATTEMPTS && content; attempt++) {
        const next = renameWikiLinks(content, noteId, title)
        if (next === content) break
        const changed = await prisma.$executeRawUnsafe(
          `UPDATE ${table} SET content = ? WHERE id = ? AND content = ?`, next, row.id, content,
        )
        if (changed > 0) break
        const fresh = await prisma.$queryRawUnsafe<{ content: string | null }[]>(
          `SELECT content FROM ${table} WHERE id = ?`, row.id,
        )
        content = fresh[0]?.content ?? null
      }
    }
  }
}

// Bring [[link]] labels in incoming HTML up to date with the linked notes' titles.
// Run on every save, so an editor that still shows an old title can't write it back.
export async function normalizeWikiLabels(html: string): Promise<string> {
  const ids = Array.from(new Set(Array.from(html.matchAll(/data-note-id="(\d+)"/g), m => Number(m[1]))))
  if (ids.length === 0) return html
  const notes = await prisma.note.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })
  return notes.reduce((out, n) => renameWikiLinks(out, n.id, n.title), html)
}
