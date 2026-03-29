export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { embedContent } from '@/lib/embedding'
import { parseBody, badRequest } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON')

  const { sourceType, sourceId } = body as { sourceType: string; sourceId: number }
  if (!sourceType || !sourceId) return badRequest('sourceType and sourceId required')

  try {
    await embedContent(sourceType, sourceId as number)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Embed failed' },
      { status: 500 }
    )
  }
}
