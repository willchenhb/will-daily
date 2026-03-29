export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { badRequest } from '@/lib/api-utils'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function isPrivateIP(hostname: string): boolean {
  // Block private/reserved IP ranges
  const patterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^localhost$/i,
    /^\[::1\]$/,
    /^\[::\]$/,
  ]
  return patterns.some(p => p.test(hostname))
}

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url')
  if (!imageUrl) {
    return badRequest('url required')
  }

  // Only allow https://
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return badRequest('invalid url')
  }

  if (parsed.protocol !== 'https:') {
    return badRequest('only https urls are allowed')
  }

  if (isPrivateIP(parsed.hostname)) {
    return badRequest('private IPs are not allowed')
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'Referer': parsed.origin,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    }

    // Validate content type
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return badRequest('response is not an image')
    }

    // Check content length if available
    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return badRequest('image too large (max 10MB)')
    }

    const buffer = await res.arrayBuffer()

    // Double-check actual size
    if (buffer.byteLength > MAX_SIZE) {
      return badRequest('image too large (max 10MB)')
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 })
  }
}
