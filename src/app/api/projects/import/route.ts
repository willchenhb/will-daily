export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

interface ImportRow {
  name: string
  category?: string
  owner?: string
  priority?: string
  startDate?: string
  targetEndDate?: string
  okrObjectiveId?: string
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

  const rows = body.projects
  if (!Array.isArray(rows)) return badRequest('projects must be an array')

  // Load all team members for name matching
  const teamMembers = await prisma.teamMember.findMany({
    select: { id: true, name: true },
  })
  const memberByName = new Map(teamMembers.map((m) => [m.name.trim().toLowerCase(), m.id]))

  // Load existing project names to skip duplicates
  const existing = await prisma.project.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()))

  const created: { code: string; name: string }[] = []
  const skipped: { name: string; reason: string }[] = []

  for (const row of rows as ImportRow[]) {
    if (!row.name || typeof row.name !== 'string') {
      skipped.push({ name: String(row.name ?? ''), reason: 'missing name' })
      continue
    }

    const nameTrimmed = row.name.trim()

    if (existingNames.has(nameTrimmed.toLowerCase())) {
      skipped.push({ name: nameTrimmed, reason: 'duplicate' })
      continue
    }

    // Match owner by name
    const ownerKey = row.owner ? row.owner.trim().toLowerCase() : ''
    const ownerId = memberByName.get(ownerKey)

    if (!ownerId) {
      skipped.push({ name: nameTrimmed, reason: `owner not found: ${row.owner ?? '(none)'}` })
      continue
    }

    const code = await generateProjectCode()

    const project = await prisma.project.create({
      data: {
        name: nameTrimmed,
        code,
        category: row.category || '产品交付',
        ownerId,
        priority: row.priority || 'P1',
        startDate: row.startDate || undefined,
        targetEndDate: row.targetEndDate || undefined,
        okrObjectiveId: row.okrObjectiveId || undefined,
      },
      select: { code: true, name: true },
    })

    created.push(project)
    existingNames.add(nameTrimmed.toLowerCase())
  }

  return NextResponse.json({ created, skipped, total: rows.length }, { status: 201 })
}
