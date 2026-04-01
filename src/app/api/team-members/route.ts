export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const members = await prisma.teamMember.findMany({
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(members)
}
