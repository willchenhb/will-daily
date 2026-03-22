import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeArticle } from '@/lib/scraper'
import { analyzeArticle } from '@/lib/kimi'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')

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
  const body = await request.json()
  const { url } = body

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const existing = await prisma.curatedArticle.findUnique({ where: { url } })
  if (existing) {
    return NextResponse.json({ error: '该链接已收藏' }, { status: 409 })
  }

  try {
    const meta = await scrapeArticle(url)

    const article = await prisma.curatedArticle.create({
      data: {
        url,
        title: meta.title,
        image: meta.image,
        content: meta.content,
        source: meta.source,
        summary: '__generating__',
      },
    })

    // Async: analyze article (summary + tags)
    if (meta.content) {
      analyzeArticle(meta.content)
        .then(result => {
          prisma.curatedArticle.update({
            where: { id: article.id },
            data: {
              summary: result.summary,
              tags: result.tags.join(','),
            },
          }).catch(() => {})
        })
        .catch(() => {
          prisma.curatedArticle.update({
            where: { id: article.id },
            data: { summary: null },
          }).catch(() => {})
        })
    }

    return NextResponse.json(article, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch article'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
