export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_CATEGORIES = ['时政新闻', 'AI新闻', '产品热点']

interface ParsedItem {
  category: string
  title: string
  summary?: string
  url?: string
  source?: string
  date?: string
}

// Parse raw text into digest items. Supports two formats:
// Format A (numbered): "1. 🤖 Title\n📍 Source | Date\nSummary\n2. ..."
// Format B (emoji-prefixed): "🇨🇳 Title\n📍 Source | Date\nSummary\n🌍 Title\n..."
// Also handles section headers like 【国内要闻】【国际要闻】
function parseRawText(text: string, category: string): ParsedItem[] {
  // Strip section headers and footer lines
  const cleaned = text
    .replace(/^【[^】]+】\s*$/gm, '')  // 【国内要闻】etc
    .replace(/^[🔥⚡].{0,4}(播报|完毕).*$/gm, '')  // 🔥 火仔播报完毕...
    .trim()

  // Detect format: numbered vs emoji-prefixed
  const hasNumbered = /^\s*\d+[\.\)、]\s+/m.test(cleaned)

  let blocks: string[]
  if (hasNumbered) {
    // Split by "1. " "2. " etc
    blocks = cleaned.split(/\n\s*(?=\d+[\.\)、]\s+)/).filter(b => b.trim())
  } else {
    // Split by lines starting with emoji (flag/icon) — each item starts with an emoji
    blocks = cleaned.split(/\n(?=[^\s\w\u4e00-\u9fff📍])/).filter(b => b.trim())
  }

  const items: ParsedItem[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // First line: strip numbering and leading emoji to get title
    const title = lines[0]
      .replace(/^\d+[\.\)、]\s*/, '')  // strip "1. "
      .replace(/^[^\w\u4e00-\u9fff]+\s*/, '')  // strip leading emoji
      .trim()
    if (!title || title.length < 4) continue  // skip noise

    let source: string | undefined
    const summaryLines: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('📍')) {
        // Source line: "📍 新华社/路透社 | 2026年4月3日"
        source = line
          .replace(/^📍\s*/, '')
          .replace(/\s*\|\s*\d{4}[-年]\d{1,2}[-月]\d{1,2}.*$/, '')  // 2026-04-03 or 2026年4月3日
          .replace(/\s*\|\s*\d{1,2}月\d{1,2}日.*$/, '')  // 4月3日
          .trim()
      } else {
        summaryLines.push(line)
      }
    }

    items.push({
      category,
      title,
      summary: summaryLines.length > 0 ? summaryLines.join(' ') : undefined,
      source: source || undefined,
    })
  }

  return items
}

// POST /api/digest/push
// Auth: Bearer <apiToken>
// Supports 3 formats:
//   1. Structured: { items: [{ category, title, summary?, url?, source? }] }
//   2. Single item: { category, title, summary?, url?, source? }
//   3. Raw text: { category: "AI新闻", text: "1. 🤖 标题\n📍来源\n摘要..." }
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

  let body
  try {
    //body = await request.json()
    const raw = await request.text()  // 改成先读 text
    console.log('RAW BODY:', JSON.stringify(raw))  // 打印原始内容
    console.log('X-Real-IP:', request.headers.get('x-real-ip'))
    console.log('X-Forwarded-For:', request.headers.get('x-forwarded-for'))
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body. Check for unescaped quotes or special characters in text.' },
      { status: 400 },
    )
  }
  const today = new Date().toISOString().slice(0, 10)

  let items: ParsedItem[]

  if (body.text && typeof body.text === 'string') {
    // Raw text mode: parse the text into items
    const category = body.category
    if (!category) {
      return NextResponse.json({ error: 'category is required when using text mode' }, { status: 400 })
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
    }
    items = parseRawText(body.text, category)
    if (items.length === 0) {
      return NextResponse.json({ error: 'No items could be parsed from text' }, { status: 400 })
    }
  } else {
    // Structured mode
    items = Array.isArray(body.items) ? body.items : [body]

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

  return NextResponse.json({
    success: true,
    count: created.count,
    date: today,
    parsed: items.map(i => ({ title: i.title, source: i.source })),
  })
}
