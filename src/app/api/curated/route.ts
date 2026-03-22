import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeArticle } from '@/lib/scraper'
import { generateSummary } from '@/lib/kimi'

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

  // Check if already exists
  const existing = await prisma.curatedArticle.findUnique({ where: { url } })
  if (existing) {
    return NextResponse.json({ error: '该链接已收藏' }, { status: 409 })
  }

  try {
    // Scrape article
    const meta = await scrapeArticle(url)

    // Create article first
    const article = await prisma.curatedArticle.create({
      data: {
        url,
        title: meta.title,
        image: meta.image,
        content: meta.content,
        source: meta.source,
      },
    })

    // Try to generate summary (non-blocking failure)
    try {
      if (meta.content) {
        const summary = await generateSummary(meta.content)
        await prisma.curatedArticle.update({
          where: { id: article.id },
          data: { summary },
        })
        return NextResponse.json({ ...article, summary }, { status: 201 })
      }
    } catch {
      // Summary generation failed, article still saved
    }

    return NextResponse.json(article, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch article'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
