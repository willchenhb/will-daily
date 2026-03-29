export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Dynamic imports to avoid SSG triggering better-sqlite3
  const { prisma } = await import('@/lib/prisma')
  const { getCurrentUser, isAdmin, generateApiToken } = await import('@/lib/auth')
  const { badRequest, notFound } = await import('@/lib/api-utils')

  const user = await getCurrentUser(request)
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('Invalid user ID')

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return notFound('User not found')

  const newToken = generateApiToken()
  const updated = await prisma.user.update({
    where: { id },
    data: { apiToken: newToken },
    select: { id: true, username: true, apiToken: true },
  })

  return NextResponse.json(updated)
}
