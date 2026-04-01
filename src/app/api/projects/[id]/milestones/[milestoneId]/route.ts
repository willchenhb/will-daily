export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; milestoneId: string } }
) {
  const milestoneId = parseId(params.milestoneId)
  if (milestoneId === null) return badRequest('Invalid milestoneId')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  try {
    const milestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(body.title !== undefined && { title: body.title as string }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate as string }),
        ...(body.completedDate !== undefined && { completedDate: body.completedDate as string }),
        ...(body.status !== undefined && { status: body.status as string }),
        ...(body.deliverables !== undefined && { deliverables: body.deliverables as string }),
        ...(body.order !== undefined && { order: body.order as number }),
      },
    })
    return NextResponse.json(milestone)
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Milestone not found')
    }
    throw e
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; milestoneId: string } }
) {
  const milestoneId = parseId(params.milestoneId)
  if (milestoneId === null) return badRequest('Invalid milestoneId')

  try {
    await prisma.milestone.delete({ where: { id: milestoneId } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Milestone not found')
    }
    throw e
  }
}
