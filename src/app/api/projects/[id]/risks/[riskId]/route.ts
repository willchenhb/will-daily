export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; riskId: string } }
) {
  const riskId = parseId(params.riskId)
  if (riskId === null) return badRequest('Invalid riskId')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  try {
    const risk = await prisma.projectRisk.update({
      where: { id: riskId },
      data: {
        ...(body.title !== undefined && { title: body.title as string }),
        ...(body.probability !== undefined && { probability: body.probability as string }),
        ...(body.impact !== undefined && { impact: body.impact as string }),
        ...(body.mitigation !== undefined && { mitigation: body.mitigation as string }),
        ...(body.status !== undefined && { status: body.status as string }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId as number }),
        ...(body.identifiedDate !== undefined && { identifiedDate: body.identifiedDate as string }),
        ...(body.resolvedDate !== undefined && { resolvedDate: body.resolvedDate as string }),
      },
      include: {
        owner: { select: { id: true, name: true, avatarColor: true } },
      },
    })
    return NextResponse.json(risk)
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Risk not found')
    }
    throw e
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; riskId: string } }
) {
  const riskId = parseId(params.riskId)
  if (riskId === null) return badRequest('Invalid riskId')

  try {
    await prisma.projectRisk.delete({ where: { id: riskId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Risk not found')
    }
    throw e
  }
}
