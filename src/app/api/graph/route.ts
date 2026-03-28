import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [nodes, edges] = await Promise.all([
    prisma.contentNode.findMany({
      select: { id: true, sourceType: true, sourceId: true, title: true, snippet: true },
    }),
    prisma.contentEdge.findMany({
      select: { nodeAId: true, nodeBId: true, weight: true },
    }),
  ])
  return NextResponse.json({ nodes, edges })
}
