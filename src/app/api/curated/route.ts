export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeArticle } from '@/lib/scraper'
import { analyzeArticle } from '@/lib/kimi'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20') || 20))
  const category = searchParams.get('category') || undefined
  const status = searchParams.get('status') || undefined
  const search = searchParams.get('search') || undefined

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (category) where.category = category
  if (status) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { summary: { contains: search } },
    ]
  }

  const [articles, total, categoryCounts] = await Promise.all([
    prisma.curatedArticle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.curatedArticle.count({ where }),
    prisma.curatedArticle.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ])

  // Convert groupBy to a map
  const counts: Record<string, number> = {}
  for (const row of categoryCounts) {
    counts[row.category || 'other'] = (counts[row.category || 'other'] || 0) + row._count.id
  }

  return NextResponse.json({ articles, total, page, size, counts })
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { url } = body as { url?: string }

  if (!url) {
    return badRequest('url is required')
  }

  const existing = await prisma.curatedArticle.findUnique({ where: { url } })
  if (existing) {
    return NextResponse.json({ error: '该链接已收藏' }, { status: 409 })
  }

  try {
    const meta = await scrapeArticle(url)

    // Save article immediately with pending status
    const article = await prisma.curatedArticle.create({
      data: {
        url,
        title: meta.title,
        author: meta.author,
        image: meta.image,
        content: meta.content,
        source: meta.source,
        status: 'pending',
      },
    })

    // Async analysis in background (non-blocking)
    if (meta.content) {
      prisma.curatedArticle.update({
        where: { id: article.id },
        data: { status: 'analyzing' },
      }).then(() => analyzeArticle(meta.content))
        .then(result => {
          return prisma.curatedArticle.update({
            where: { id: article.id },
            data: {
              summary: result.summary,
              keyPoints: JSON.stringify(result.keyPoints),
              tags: result.tags.join(','),
              category: result.category,
              status: 'done',
            },
          })
        })
        .then(() => console.log(`Article ${article.id} analysis complete`))
        .catch(e => {
          console.error(`Article ${article.id} analysis failed:`, e instanceof Error ? e.message : e)
          prisma.curatedArticle.update({
            where: { id: article.id },
            data: { status: 'failed' },
          }).catch(() => {})
        })
    }

    return NextResponse.json(article, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch article'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
