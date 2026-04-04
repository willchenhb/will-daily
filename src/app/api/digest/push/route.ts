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

// Parse raw text like:
// 1. 🤖 谷歌发布 Gemma 4 开源大模型系列
// 📍 Google Blog / 36氪 | 4月3日
// 谷歌正式推出 Gemma 4 系列...
function parseRawText(text: string, category: string): ParsedItem[] {
  const items: ParsedItem[] = []
  // Split by numbered items: "1. " "2. " etc
  const blocks = text.split(/\n\s*\d+\.\s+/).filter(b => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // First line: strip leading number/emoji/punctuation
    const title = lines[0]
      .replace(/^\d+[\.\)、]\s*/, '')  // strip "1. " "2) " etc
      .replace(/^[^\w\u4e00-\u9fff]+\s*/, '')  // strip leading non-word/non-CJK (emoji etc)
      .trim()
    if (!title) continue

    let source: string | undefined
    let summary: string | undefined
    const summaryLines: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      // Source line: 📍 xxx | date
      if (line.startsWith('📍')) {
        source = line.replace(/^📍\s*/, '').replace(/\s*\|\s*\d+.*$/, '').trim()
      } else if (!line.startsWith('🔥') && !line.startsWith('---')) {
        // Summary lines (skip footer lines like 🔥 火仔播报)
        summaryLines.push(line)
      }
    }

    if (summaryLines.length > 0) {
      summary = summaryLines.join(' ')
    }

    items.push({ category, title, summary, source })
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

  const body = await request.json()
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
