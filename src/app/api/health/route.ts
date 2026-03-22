import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check DB connectivity
    await prisma.setting.count()
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      error: e instanceof Error ? e.message : 'Unknown',
    }, { status: 503 })
  }
}
