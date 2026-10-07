export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, badRequest, notFound } from '@/lib/api-utils'
import { MATERIAL_SANDBOX } from '@/lib/materials'

// GET /api/materials/:id/raw — serve the uploaded HTML for rendering (?download=1 to save)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const material = await prisma.material.findUnique({
    where: { id },
    select: { content: true, filename: true },
  })
  if (!material) return notFound('Material not found')

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    // Uploaded HTML is untrusted: isolate it even when opened directly in a tab
    'Content-Security-Policy': `sandbox ${MATERIAL_SANDBOX}`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-cache',
  })

  if (request.nextUrl.searchParams.get('download') === '1') {
    const ascii = material.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
    headers.set(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(material.filename)}`
    )
  }

  return new NextResponse(material.content, { headers })
}
