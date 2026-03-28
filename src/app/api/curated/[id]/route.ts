import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeArticle } from '@/lib/kimi'
import { parseId, badRequest, notFound } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const article = await prisma.curatedArticle.findUnique({ where: { id } })
  if (!article) return notFound('Article not found')
  return NextResponse.json(article)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.curatedArticle.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Article not found')
    }
    throw e
  }
}

// Re-analyze: generate summary + tags + keyPoints + category
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const article = await prisma.curatedArticle.findUnique({ where: { id } })
  if (!article) return notFound('Article not found')
  if (!article.content) return badRequest('文章内容为空')

  try {
    const result = await analyzeArticle(article.content)
    await prisma.curatedArticle.update({
      where: { id },
      data: {
        summary: result.summary,
        keyPoints: JSON.stringify(result.keyPoints),
        tags: result.tags.join(','),
        category: result.category,
        status: 'done',
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed'
    await prisma.curatedArticle.update({
      where: { id },
      data: { status: 'failed' },
    }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
