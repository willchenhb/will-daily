import { prisma } from '@/lib/prisma'
import { renameWikiLinks, wikiLinkMarker } from '@/lib/wiki'

// Rewrite the label of every [[link]] to a renamed note, so links read the new title
// and full-text search finds them by it
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

  const updates = [
    ...notes.map(r => ({ next: rewrite(r.content), run: (content: string) => prisma.note.update({ where: { id: r.id }, data: { content } }) })),
    ...diaries.map(r => ({ next: rewrite(r.content), run: (content: string) => prisma.diaryEntry.update({ where: { id: r.id }, data: { content } }) })),
    ...weeklies.map(r => ({ next: rewrite(r.content), run: (content: string) => prisma.weeklyPlan.update({ where: { id: r.id }, data: { content } }) })),
  ]
  for (const u of updates) {
    if (u.next !== null) await u.run(u.next)
  }
}
