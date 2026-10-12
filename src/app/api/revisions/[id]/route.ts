export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, badRequest, notFound } from '@/lib/api-utils'

// GET /api/revisions/:id → one earlier version with its content
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')
  const revision = await prisma.revision.findUnique({ where: { id } })
  if (!revision) return notFound('Revision not found')
  return NextResponse.json(revision)
}
