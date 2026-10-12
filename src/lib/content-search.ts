// Server-side lookup over notes, diary entries and weekly plans, shared by full-text
// search, tag pages and backlinks.
import { prisma } from '@/lib/prisma'
import { htmlToText } from '@/lib/html'
import type { ContentResult } from '@/components/ContentResults'

interface FindOptions {
  // Lowercased words that must all appear in the plain text (title included)
  terms?: string[]
  // Raw HTML substring every result must contain, e.g. data-tag="读书"
  marker?: string
  // Where to centre the snippet; defaults to `terms`
  snippetTerms?: string[]
  perType?: number
}

const BATCH = 50 // rows fetched at a time before filtering on plain text
const MAX_SCAN = 1000 // per type; bounds the work for terms that mostly hit markup
const SNIPPET_BEFORE = 30
const SNIPPET_LENGTH = 120

// Text around the first occurrence of any of `terms`
function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase()
  const hit = terms.map(t => lower.indexOf(t.toLowerCase())).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, hit - SNIPPET_BEFORE)
  const end = Math.min(text.length, start + SNIPPET_LENGTH)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function matchesAll(haystack: string, terms: string[]): boolean {
  const lower = haystack.toLowerCase()
  return terms.every(t => lower.includes(t))
}

// Page through LIKE candidates until `limit` rows pass the plain-text check. A term like
// "api" or "data" also matches markup (data-type, /api/uploads/…) in every document, so
// a single batch could be all false positives and hide older real matches.
async function collect<R, M>(
  fetchBatch: (skip: number) => Promise<R[]>,
  toMatch: (row: R) => M | null,
  limit: number,
): Promise<M[]> {
  const out: M[] = []
  for (let skip = 0; skip < MAX_SCAN; skip += BATCH) {
    const batch = await fetchBatch(skip)
    for (const row of batch) {
      const m = toMatch(row)
      if (m) out.push(m)
      if (out.length >= limit) return out
    }
    if (batch.length < BATCH) break
  }
  return out
}

// Rows are narrowed with LIKE on the stored HTML, then matched again on the plain text
// so markup (tag names, attributes, image URLs) never produces term hits.
export async function findContent({ terms = [], marker, snippetTerms = terms, perType = 10 }: FindOptions): Promise<ContentResult[]> {
  if (terms.length === 0 && !marker) return []

  const markerWhere = marker ? [{ content: { contains: marker } }] : []
  const anyField = (fields: string[]) => [
    ...terms.map(t => ({ OR: fields.map(f => ({ [f]: { contains: t } })) })),
    ...markerWhere,
  ]

  const [notes, diaries, weeklies] = await Promise.all([
    collect(
      skip => prisma.note.findMany({
        where: { AND: anyField(['title', 'content', 'category']) },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: BATCH,
        select: { id: true, title: true, content: true, category: true, updatedAt: true },
      }),
      n => {
        const text = htmlToText(n.content)
        return matchesAll(`${n.title} ${n.category || ''} ${text}`, terms) ? { n, text } : null
      },
      perType,
    ),
    collect(
      skip => prisma.diaryEntry.findMany({
        where: { AND: anyField(['content']) },
        orderBy: { date: 'desc' },
        skip,
        take: BATCH,
        select: { id: true, date: true, type: true, content: true },
      }),
      d => {
        const text = htmlToText(d.content)
        return matchesAll(text, terms) ? { d, text } : null
      },
      perType,
    ),
    collect(
      skip => prisma.weeklyPlan.findMany({
        where: {
          AND: [
            ...terms.map(t => ({
              OR: [
                { title: { contains: t } },
                { content: { contains: t } },
                { todos: { some: { text: { contains: t } } } },
              ],
            })),
            ...markerWhere,
          ],
        },
        orderBy: { weekStart: 'desc' },
        skip,
        take: BATCH,
        select: { id: true, weekStart: true, title: true, content: true, todos: { select: { text: true }, orderBy: { order: 'asc' } } },
      }),
      w => {
        const text = [w.content ? htmlToText(w.content) : '', ...w.todos.map(t => t.text)].join(' ').trim()
        return matchesAll(`${w.title || ''} ${text}`, terms) ? { w, text } : null
      },
      perType,
    ),
  ])

  return [
    ...notes.map(({ n, text }) => ({
      type: 'note' as const,
      id: n.id,
      title: n.title || '无标题',
      snippet: makeSnippet(text, snippetTerms),
      date: n.updatedAt.toISOString().slice(0, 10),
      href: `/notes/${n.id}`,
    })),
    ...diaries.map(({ d, text }) => ({
      type: 'diary' as const,
      id: d.id,
      title: d.type === 'chat_summary' ? '群聊总结' : '日记',
      snippet: makeSnippet(text, snippetTerms),
      date: d.date,
      href: `/diary?date=${d.date}`,
    })),
    ...weeklies.map(({ w, text }) => ({
      type: 'weekly' as const,
      id: w.id,
      title: w.title || '周记',
      snippet: makeSnippet(text, snippetTerms),
      date: w.weekStart,
      href: `/weekly?week=${w.weekStart}`,
    })),
  ]
}
