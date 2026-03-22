import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeArticle } from '@/lib/kimi'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const article = await prisma.curatedArticle.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(article)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  await prisma.curatedArticle.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// Re-analyze: generate summary + tags
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const article = await prisma.curatedArticle.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: '文章内容为空' }, { status: 400 })

  try {
    const result = await analyzeArticle(article.content)
    await prisma.curatedArticle.update({
      where: { id },
      data: {
        summary: result.summary,
        tags: result.tags.join(','),
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
