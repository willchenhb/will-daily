export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { rebuildAllEmbeddings } from '@/lib/embedding'

export async function POST() {
  try {
    const result = await rebuildAllEmbeddings()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Rebuild failed' },
      { status: 500 }
    )
  }
}
