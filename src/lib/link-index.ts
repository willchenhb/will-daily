// The [[link]] graph between notes, diary entries and weekly plans, read straight from
// the stored HTML (like Obsidian's resolvedLinks: a derived index, nothing to rebuild).
import { prisma } from '@/lib/prisma'
import type { DocType } from '@/lib/revisions-types'

export interface DocRef { key: string; sourceType: DocType; sourceId: number; title: string; href: string }
export interface WikiEdge { from: string; to: string; count: number }

export const docKey = (type: string, id: number) => `${type}:${id}`

const LINK = /data-note-id="(\d+)"/g

function countTargets(html: string | null): Map<number, number> {
  const counts = new Map<number, number>()
  for (const m of Array.from((html || '').matchAll(LINK))) {
    const id = Number(m[1])
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

export async function buildLinkIndex(): Promise<{ docs: DocRef[]; links: WikiEdge[] }> {
  const where = { content: { contains: 'data-note-id="' } }
  const [notes, diaries, weeklies] = await Promise.all([
    prisma.note.findMany({ where, select: { id: true, title: true, content: true } }),
    prisma.diaryEntry.findMany({ where, select: { id: true, date: true, type: true, content: true } }),
    prisma.weeklyPlan.findMany({ where, select: { id: true, weekStart: true, title: true, content: true } }),
  ])

  const sources: { doc: DocRef; targets: Map<number, number> }[] = [
    ...notes.map(n => ({ doc: { key: docKey('note', n.id), sourceType: 'note' as const, sourceId: n.id, title: n.title || '无标题', href: `/notes/${n.id}` }, targets: countTargets(n.content) })),
    ...diaries.map(d => ({ doc: { key: docKey('diary', d.id), sourceType: 'diary' as const, sourceId: d.id, title: `${d.type === 'chat_summary' ? '群聊总结' : '日记'} ${d.date}`, href: `/diary?date=${d.date}` }, targets: countTargets(d.content) })),
    ...weeklies.map(w => ({ doc: { key: docKey('weekly', w.id), sourceType: 'weekly' as const, sourceId: w.id, title: w.title || `周记 ${w.weekStart}`, href: `/weekly?week=${w.weekStart}` }, targets: countTargets(w.content) })),
  ]

  // Only notes that still exist are link targets (deleted notes leave dangling links)
  const targetIds = Array.from(new Set(sources.flatMap(s => Array.from(s.targets.keys()))))
  const targets = await prisma.note.findMany({ where: { id: { in: targetIds } }, select: { id: true, title: true } })
  const targetDoc = new Map(targets.map(t => [t.id, { key: docKey('note', t.id), sourceType: 'note' as const, sourceId: t.id, title: t.title || '无标题', href: `/notes/${t.id}` }]))

  const docs = new Map<string, DocRef>()
  const links: WikiEdge[] = []
  for (const { doc, targets: counts } of sources) {
    counts.forEach((count, id) => {
      const target = targetDoc.get(id)
      if (!target || target.key === doc.key) return // dangling or self link
      docs.set(doc.key, doc)
      docs.set(target.key, target)
      links.push({ from: doc.key, to: target.key, count })
    })
  }
  return { docs: Array.from(docs.values()), links }
}
