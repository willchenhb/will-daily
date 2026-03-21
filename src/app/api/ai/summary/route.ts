import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSummary } from '@/lib/kimi'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { noteId } = body

  if (!noteId) {
    return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
  }

  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (!note.content || note.content.replace(/<[^>]*>/g, '').trim().length === 0) {
    return NextResponse.json({ error: '笔记内容为空' }, { status: 400 })
  }

  try {
    const summary = await generateSummary(note.content)

    await prisma.note.update({
      where: { id: noteId },
      data: { summary },
    })

    return NextResponse.json({ summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
