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

const CANDIDATES = 50 // rows fetched per type before filtering on plain text
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

// Rows are narrowed with LIKE on the stored HTML, then matched again on the plain text
// so markup (tag names, attributes, image URLs) never produces term hits.
export async function findContent({ terms = [], marker, snippetTerms = terms, perType = 10 }: FindOptions): Promise<ContentResult[]> {
  if (terms.length === 0 && !marker) return []

  const anyField = (fields: string[]) => [
    ...terms.map(t => ({ OR: fields.map(f => ({ [f]: { contains: t } })) })),
    ...(marker ? [{ content: { contains: marker } }] : []),
  ]

  const [notes, diaries, weeklies] = await Promise.all([
    prisma.note.findMany({
      where: { AND: anyField(['title', 'content', 'category']) },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATES,
      select: { id: true, title: true, content: true, category: true, updatedAt: true },
    }),
    prisma.diaryEntry.findMany({
      where: { AND: anyField(['content']) },
      orderBy: { date: 'desc' },
      take: CANDIDATES,
      select: { id: true, date: true, type: true, content: true },
    }),
    prisma.weeklyPlan.findMany({
      where: {
        AND: [
          ...terms.map(t => ({
            OR: [
              { title: { contains: t } },
              { content: { contains: t } },
              { todos: { some: { text: { contains: t } } } },
            ],
          })),
          ...(marker ? [{ content: { contains: marker } }] : []),
        ],
      },
      orderBy: { weekStart: 'desc' },
      take: CANDIDATES,
      select: { id: true, weekStart: true, title: true, content: true, todos: { select: { text: true }, orderBy: { order: 'asc' } } },
    }),
  ])

  const results: ContentResult[] = []

  results.push(...notes
    .map(n => ({ n, text: htmlToText(n.content) }))
    .filter(({ n, text }) => matchesAll(`${n.title} ${n.category || ''} ${text}`, terms))
    .slice(0, perType)
    .map(({ n, text }) => ({
      type: 'note' as const,
      id: n.id,
      title: n.title || '无标题',
      snippet: makeSnippet(text, snippetTerms),
      date: n.updatedAt.toISOString().slice(0, 10),
      href: `/notes/${n.id}`,
    })))

  results.push(...diaries
    .map(d => ({ d, text: htmlToText(d.content) }))
    .filter(({ text }) => matchesAll(text, terms))
    .slice(0, perType)
    .map(({ d, text }) => ({
      type: 'diary' as const,
      id: d.id,
      title: d.type === 'chat_summary' ? '群聊总结' : '日记',
      snippet: makeSnippet(text, snippetTerms),
      date: d.date,
      href: `/diary?date=${d.date}`,
    })))

  results.push(...weeklies
    .map(w => ({ w, text: [w.content ? htmlToText(w.content) : '', ...w.todos.map(t => t.text)].join(' ').trim() }))
    .filter(({ w, text }) => matchesAll(`${w.title || ''} ${text}`, terms))
    .slice(0, perType)
    .map(({ w, text }) => ({
      type: 'weekly' as const,
      id: w.id,
      title: w.title || '周记',
      snippet: makeSnippet(text, snippetTerms),
      date: w.weekStart,
      href: `/weekly?week=${w.weekStart}`,
    })))

  return results
}
