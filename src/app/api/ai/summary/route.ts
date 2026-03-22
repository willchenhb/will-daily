import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSummary } from '@/lib/kimi'
import { parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { noteId } = body as { noteId?: number }

  if (!noteId) {
    return badRequest('noteId is required')
  }

  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note) {
    return notFound('Note not found')
  }

  if (!note.content || note.content.replace(/<[^>]*>/g, '').trim().length === 0) {
    return badRequest('笔记内容为空')
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
