export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, department: true, avatarColor: true } },
      milestones: { orderBy: { order: 'asc' } },
      risks: {
        include: {
          owner: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!project) return notFound('Project not found')
  return NextResponse.json({
    ...project,
    owner: project.owner.name,
    ownerId: project.ownerId,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  try {
    // Resolve owner name to ownerId if provided
    let resolvedOwnerId: number | undefined
    if (body.ownerId !== undefined) {
      resolvedOwnerId = body.ownerId as number
    } else if (typeof body.owner === 'string' && body.owner.trim()) {
      const ownerName = (body.owner as string).trim()
      let member = await prisma.teamMember.findFirst({ where: { name: ownerName } })
      if (!member) {
        member = await prisma.teamMember.create({ data: { name: ownerName } })
      }
      resolvedOwnerId = member.id
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.description !== undefined && { description: body.description as string }),
        ...(body.category !== undefined && { category: body.category as string }),
        ...(body.status !== undefined && { status: body.status as string }),
        ...(body.priority !== undefined && { priority: body.priority as string }),
        ...(resolvedOwnerId !== undefined && { ownerId: resolvedOwnerId }),
        ...(body.startDate !== undefined && { startDate: body.startDate as string }),
        ...(body.targetEndDate !== undefined && { targetEndDate: body.targetEndDate as string }),
        ...(body.okrObjectiveId !== undefined && { okrObjectiveId: body.okrObjectiveId as string }),
      },
      include: {
        owner: { select: { id: true, name: true, department: true, avatarColor: true } },
      },
    })
    return NextResponse.json({ ...project, owner: project.owner.name })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Project not found')
    }
    throw e
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  try {
    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Project not found')
    }
    throw e
  }
}
