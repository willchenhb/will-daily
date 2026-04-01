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

  const risks = await prisma.projectRisk.findMany({
    where: { projectId },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(risks)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = parseId(params.id)
  if (projectId === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { title, probability, impact, mitigation, ownerId, identifiedDate } =
    body as Record<string, unknown>

  if (!title || typeof title !== 'string') return badRequest('title is required')

  const risk = await prisma.projectRisk.create({
    data: {
      projectId,
      title,
      probability: typeof probability === 'string' ? probability : 'medium',
      impact: typeof impact === 'string' ? impact : 'medium',
      mitigation: typeof mitigation === 'string' ? mitigation : undefined,
      ownerId: typeof ownerId === 'number' ? ownerId : undefined,
      identifiedDate: typeof identifiedDate === 'string' ? identifiedDate : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true } },
    },
  })

  return NextResponse.json(risk, { status: 201 })
}
