export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/diary/push
// Auth: Bearer <apiToken>
// Body: { type: "chat_summary", date?: "YYYY-MM-DD", content: "markdown text" }
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const user = await prisma.user.findUnique({ where: { apiToken: token } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { type, date, content } = body as { type?: string; date?: string; content?: string }

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const entryType = type || 'chat_summary'
  const entryDate = date || new Date().toISOString().slice(0, 10)

  // Upsert: if same date+type exists, replace content
  const entry = await prisma.diaryEntry.upsert({
    where: { date_type: { date: entryDate, type: entryType } },
    update: { content },
    create: { date: entryDate, type: entryType, content },
  })

  return NextResponse.json({ success: true, id: entry.id, date: entryDate, type: entryType })
}
