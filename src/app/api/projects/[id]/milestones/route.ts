export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = parseId(params.id)
  if (projectId === null) return badRequest('Invalid id')

  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(milestones)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = parseId(params.id)
  if (projectId === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { title, dueDate, deliverables, order } = body as Record<string, unknown>

  if (!title || typeof title !== 'string') return badRequest('title is required')

  const maxOrder = await prisma.milestone.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      title,
      dueDate: typeof dueDate === 'string' ? dueDate : undefined,
      deliverables: typeof deliverables === 'string' ? deliverables : undefined,
      order: typeof order === 'number' ? order : (maxOrder?.order ?? -1) + 1,
    },
  })

  return NextResponse.json(milestone, { status: 201 })
}
