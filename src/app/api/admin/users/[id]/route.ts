export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { prisma } = await import('@/lib/prisma')
  const { getCurrentUser, isAdmin, hashPassword } = await import('@/lib/auth')
  const { parseBody, badRequest, notFound } = await import('@/lib/api-utils')
  const user = await getCurrentUser(request)
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('Invalid user ID')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { password, role, isActive } = body as {
    password?: string
    role?: string
    isActive?: boolean
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return notFound('User not found')

  const data: Record<string, unknown> = {}
  if (password) data.password = await hashPassword(password)
  if (role && ['admin', 'user'].includes(role)) data.role = role
  if (typeof isActive === 'boolean') data.isActive = isActive

  if (Object.keys(data).length === 0) {
    return badRequest('No valid fields to update')
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      role: true,
      apiToken: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { prisma } = await import('@/lib/prisma')
  const { getCurrentUser, isAdmin } = await import('@/lib/auth')
  const { badRequest, notFound } = await import('@/lib/api-utils')
  const user = await getCurrentUser(request)
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('Invalid user ID')

  // Prevent deleting self
  if (user && user.id === id) {
    return badRequest('Cannot delete your own account')
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) return notFound('User not found')

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
