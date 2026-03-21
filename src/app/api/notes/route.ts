import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
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
  const body = await request.json()
  const { title, content, category } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
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
