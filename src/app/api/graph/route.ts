export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildLinkIndex } from '@/lib/link-index'

// nodes/edges: the keyword graph (built by 重建图谱 via embeddings)
// docs/links: the [[link]] graph, derived from content on every request
export async function GET() {
  const [nodes, edges, linkIndex] = await Promise.all([
    prisma.contentNode.findMany({
      select: { id: true, sourceType: true, sourceId: true, title: true, snippet: true, embedding: true },
    }),
    prisma.contentEdge.findMany({
      select: { nodeAId: true, nodeBId: true, weight: true },
    }),
    buildLinkIndex(),
  ])

  // Deep links for diary / weekly nodes (their pages are addressed by date / week)
  const diaryIds = nodes.filter(n => n.sourceType === 'diary').map(n => n.sourceId)
  const weeklyIds = nodes.filter(n => n.sourceType === 'weekly').map(n => n.sourceId)
  const [diaries, weeklies] = await Promise.all([
    prisma.diaryEntry.findMany({ where: { id: { in: diaryIds } }, select: { id: true, date: true } }),
    prisma.weeklyPlan.findMany({ where: { id: { in: weeklyIds } }, select: { id: true, weekStart: true } }),
  ])
  const diaryDate = new Map(diaries.map(d => [d.id, d.date]))
  const weekOf = new Map(weeklies.map(w => [w.id, w.weekStart]))
  const hrefOf = (type: string, id: number) => {
    switch (type) {
      case 'note': return `/notes/${id}`
      case 'article': return `/curated/${id}`
      case 'diary': return diaryDate.has(id) ? `/diary?date=${diaryDate.get(id)}` : '/diary'
      case 'weekly': return weekOf.has(id) ? `/weekly?week=${weekOf.get(id)}` : '/weekly'
      default: return '/'
    }
  }

  return NextResponse.json({
    nodes: nodes.map(n => ({ ...n, href: hrefOf(n.sourceType, n.sourceId) })),
    edges,
    docs: linkIndex.docs,
    links: linkIndex.links,
  })
}
