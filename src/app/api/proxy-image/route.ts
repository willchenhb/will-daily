import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url')
  if (!imageUrl) {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'Referer': new URL(imageUrl).origin,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

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
