export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest, notFound } from '@/lib/api-utils'
import { isUploadKey } from '@/lib/uploads'

// GET /api/uploads/:key — serve an uploaded image (content is immutable per key)
export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!isUploadKey(params.key)) return badRequest('Invalid key')

  const upload = await prisma.upload.findUnique({
    where: { key: params.key },
    select: { mime: true, data: true },
  })
  if (!upload) return notFound('Image not found')

  return new NextResponse(upload.data, {
    headers: {
      'Content-Type': upload.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
