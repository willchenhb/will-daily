import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeArticle } from '@/lib/scraper'
import { analyzeArticle } from '@/lib/kimi'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20') || 20))

  const [articles, total] = await Promise.all([
    prisma.curatedArticle.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.curatedArticle.count(),
  ])

  return NextResponse.json({ articles, total, page, size })
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

    // Save article immediately so user gets fast response
    const article = await prisma.curatedArticle.create({
      data: {
        url,
        title: meta.title,
        image: meta.image,
        content: meta.content,
        source: meta.source,
      },
    })

    // Async analysis in background (non-blocking)
    if (meta.content) {
      analyzeArticle(meta.content)
        .then(result => {
          return prisma.curatedArticle.update({
            where: { id: article.id },
            data: { summary: result.summary, tags: result.tags.join(',') },
          })
        })
        .then(() => console.log(`Article ${article.id} analysis complete`))
        .catch(e => {
          console.error(`Article ${article.id} analysis failed:`, e instanceof Error ? e.message : e)
        })
    }

    return NextResponse.json(article, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch article'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
