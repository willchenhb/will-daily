import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20') || 20))
  const category = searchParams.get('category')

  const where = category ? { category } : {}

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.note.count({ where }),
  ])

  return NextResponse.json({ notes, total, page, size })
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { title, content, category } = body as { title?: string; content?: string; category?: string }

  if (!title) {
    return badRequest('title is required')
  }

  const note = await prisma.note.create({
    data: {
      title,
      content: content || '',
      category: category ? category.trim().toLowerCase() : null,
    },
  })

  return NextResponse.json(note, { status: 201 })
}
