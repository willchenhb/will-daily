export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_CATEGORIES = ['时政新闻', 'AI新闻', '产品热点']

// POST /api/digest/push
// Auth: Bearer <apiToken>
// Body: { items: [{ category, title, summary?, url?, source? }] }
//   or single: { category, title, summary?, url?, source? }
export async function POST(request: NextRequest) {
  // Verify API token
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const user = await prisma.user.findUnique({ where: { apiToken: token } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 401 })
  }

  const body = await request.json()
  const today = new Date().toISOString().slice(0, 10)

  // Support both single item and batch
  const items: Array<{
    category: string
    title: string
    summary?: string
    url?: string
    source?: string
    date?: string
  }> = Array.isArray(body.items) ? body.items : [body]

  // Validate
  const errors: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item.title) errors.push(`items[${i}]: title is required`)
    if (!item.category) errors.push(`items[${i}]: category is required`)
    else if (!VALID_CATEGORIES.includes(item.category)) {
      errors.push(`items[${i}]: category must be one of: ${VALID_CATEGORIES.join(', ')}`)
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
  }

  // Insert
  const created = await prisma.dailyDigest.createMany({
    data: items.map(item => ({
      date: item.date || today,
      category: item.category,
      title: item.title,
      summary: item.summary || null,
      url: item.url || null,
      source: item.source || null,
    })),
  })

  return NextResponse.json({ success: true, count: created.count, date: today })
}
