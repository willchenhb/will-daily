export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { findContent } from '@/lib/content-search'

// GET /api/search?q=… — full-text search over notes, diary entries and weekly plans.
// Space-separated words must all match.
export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim() || ''
  const terms = Array.from(new Set(q.toLowerCase().split(/\s+/).filter(Boolean))).slice(0, 5)
  return NextResponse.json({ results: await findContent({ terms }) })
}
