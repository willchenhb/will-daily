export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

function computeHealth(
  milestones: { status: string }[],
  risks: { probability: string; impact: string; status: string }[]
): 'green' | 'yellow' | 'red' {
  const delayedMilestones = milestones.filter((m) => m.status === 'delayed').length
  const highRisks = risks.filter(
    (r) => r.status === 'open' && (r.probability === 'high' || r.impact === 'high')
  ).length

  if (delayedMilestones >= 2 || highRisks >= 2) return 'red'
  if (delayedMilestones >= 1 || highRisks >= 1) return 'yellow'
  return 'green'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || undefined
  const category = searchParams.get('category') || undefined
  const ownerIdStr = searchParams.get('ownerId')
  const ownerId = ownerIdStr ? parseInt(ownerIdStr) || undefined : undefined
  const search = searchParams.get('search') || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status) where.status = status
  if (category) where.category = category
  if (ownerId) where.ownerId = ownerId
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, name: true, department: true, avatarColor: true } },
      milestones: { select: { status: true } },
      risks: { select: { probability: true, impact: true, status: true } },
    },
  })

  const result = projects.map((p) => {
    const totalMilestones = p.milestones.length
    const completedMilestones = p.milestones.filter((m) => m.status === 'completed').length
    const openRisks = p.risks.filter((r) => r.status === 'open').length
    const health = computeHealth(p.milestones, p.risks)

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      category: p.category,
      status: p.status,
      priority: p.priority,
      startDate: p.startDate,
      targetEndDate: p.targetEndDate,
      okrObjectiveId: p.okrObjectiveId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      owner: p.owner,
      milestoneProgress: { completed: completedMilestones, total: totalMilestones },
      openRiskCount: openRisks,
      health,
    }
  })

  return NextResponse.json(result)
}

async function generateProjectCode(): Promise<string> {
  const last = await prisma.project.findFirst({
    where: { code: { startsWith: 'PRJ-' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  let nextNum = 1
  if (last) {
    const num = parseInt(last.code.replace('PRJ-', ''))
    if (!isNaN(num)) nextNum = num + 1
  }

  return `PRJ-${String(nextNum).padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { name, category, ownerId, description, priority, startDate, targetEndDate, okrObjectiveId } =
    body as Record<string, unknown>

  if (!name || typeof name !== 'string') return badRequest('name is required')
  if (!category || typeof category !== 'string') return badRequest('category is required')
  if (!ownerId || typeof ownerId !== 'number') return badRequest('ownerId is required (number)')

  const code = await generateProjectCode()

  const project = await prisma.project.create({
    data: {
      name,
      code,
      category,
      ownerId,
      description: typeof description === 'string' ? description : undefined,
      priority: typeof priority === 'string' ? priority : 'P1',
      startDate: typeof startDate === 'string' ? startDate : undefined,
      targetEndDate: typeof targetEndDate === 'string' ? targetEndDate : undefined,
      okrObjectiveId: typeof okrObjectiveId === 'string' ? okrObjectiveId : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, department: true, avatarColor: true } },
    },
  })

  return NextResponse.json(project, { status: 201 })
}
