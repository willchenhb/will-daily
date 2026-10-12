import { prisma } from '@/lib/prisma'
import { renameWikiLinks, wikiLinkMarker } from '@/lib/wiki'

// Rewrite the label of every [[link]] to a renamed note, so links read the new title
// and full-text search finds them by it.
// Raw SQL on purpose: this is not an edit of those documents, so their updatedAt (used
// for ordering and edit-conflict detection) must not change.
export async function propagateNoteTitle(noteId: number, title: string): Promise<void> {
  const where = { content: { contains: wikiLinkMarker(noteId) } }
  const select = { id: true, content: true }
  const [notes, diaries, weeklies] = await Promise.all([
    prisma.note.findMany({ where, select }),
    prisma.diaryEntry.findMany({ where, select }),
    prisma.weeklyPlan.findMany({ where, select }),
  ])

  const rewrite = (content: string | null) => {
    if (!content) return null
    const next = renameWikiLinks(content, noteId, title)
    return next === content ? null : next
  }

  for (const r of notes) {
    const next = rewrite(r.content)
    if (next !== null) await prisma.$executeRaw`UPDATE Note SET content = ${next} WHERE id = ${r.id}`
  }
  for (const r of diaries) {
    const next = rewrite(r.content)
    if (next !== null) await prisma.$executeRaw`UPDATE DiaryEntry SET content = ${next} WHERE id = ${r.id}`
  }
  for (const r of weeklies) {
    const next = rewrite(r.content)
    if (next !== null) await prisma.$executeRaw`UPDATE WeeklyPlan SET content = ${next} WHERE id = ${r.id}`
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
