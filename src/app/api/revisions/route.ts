export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest } from '@/lib/api-utils'
import { htmlToText, isEmptyHtml } from '@/lib/html'
import { addRevision, type DocType } from '@/lib/revisions'

const TYPES: DocType[] = ['note', 'diary', 'weekly']
const isDocType = (t: unknown): t is DocType => TYPES.includes(t as DocType)

// GET /api/revisions?type=note&id=12 → earlier versions, newest first (without content)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || ''
  const id = parseId(searchParams.get('id') || '')
  if (!isDocType(type) || id === null) return badRequest('type and id are required')

  const revisions = await prisma.revision.findMany({
    where: { sourceType: type, sourceId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    revisions: revisions.map(r => {
      const text = htmlToText(r.content)
      return { id: r.id, title: r.title, createdAt: r.createdAt, chars: text.length, preview: text.slice(0, 80) }
    }),
  })
}

// POST /api/revisions { type, id, title?, content } — keep a version the client is about
// to discard (unsaved local edits replaced by "载入最新版本" after an edit conflict)
export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')
  const { type, id, title, content } = body as { type?: unknown; id?: unknown; title?: unknown; content?: unknown }
  if (!isDocType(type) || typeof id !== 'number' || typeof content !== 'string') {
    return badRequest('type, id and content are required')
  }
  if (!isEmptyHtml(content)) await addRevision(type, id, typeof title === 'string' ? title : null, content)
  return NextResponse.json({ ok: true }, { status: 201 })
}
