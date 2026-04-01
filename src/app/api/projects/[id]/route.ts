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
  return NextResponse.json(project)
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
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.description !== undefined && { description: body.description as string }),
        ...(body.category !== undefined && { category: body.category as string }),
        ...(body.status !== undefined && { status: body.status as string }),
        ...(body.priority !== undefined && { priority: body.priority as string }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId as number }),
        ...(body.startDate !== undefined && { startDate: body.startDate as string }),
        ...(body.targetEndDate !== undefined && { targetEndDate: body.targetEndDate as string }),
        ...(body.okrObjectiveId !== undefined && { okrObjectiveId: body.okrObjectiveId as string }),
      },
      include: {
        owner: { select: { id: true, name: true, department: true, avatarColor: true } },
      },
    })
    return NextResponse.json(project)
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
