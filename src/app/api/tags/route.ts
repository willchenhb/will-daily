export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findContent } from '@/lib/content-search'
import { extractTags, isValidTag, tagMarker } from '@/lib/wiki'

// GET /api/tags            → { tags: [{ name, count }] }, count = documents carrying the tag
// GET /api/tags?t=读书     → { results } documents tagged #读书
// Tags live in the content HTML (no tag table), so they can never drift out of sync.
export async function GET(request: NextRequest) {
  const tag = new URL(request.url).searchParams.get('t')?.trim()

  if (tag) {
    if (!isValidTag(tag)) return NextResponse.json({ results: [] })
    const results = await findContent({ marker: tagMarker(tag), snippetTerms: [`#${tag}`], perType: 100 })
    return NextResponse.json({ results })
  }

  const where = { content: { contains: 'data-tag="' } }
  const [notes, diaries, weeklies] = await Promise.all([
    prisma.note.findMany({ where, select: { content: true } }),
    prisma.diaryEntry.findMany({ where, select: { content: true } }),
    prisma.weeklyPlan.findMany({ where, select: { content: true } }),
  ])

  const counts = new Map<string, number>()
  for (const { content } of [...notes, ...diaries, ...weeklies]) {
    for (const name of extractTags(content || '')) counts.set(name, (counts.get(name) || 0) + 1)
  }
  const tags = Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
  return NextResponse.json({ tags })
}
