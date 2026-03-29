export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { prisma } = await import('@/lib/prisma')
  const { getCurrentUser, isAdmin } = await import('@/lib/auth')
  const user = await getCurrentUser(request)
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      apiToken: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const { prisma } = await import('@/lib/prisma')
  const { getCurrentUser, isAdmin, hashPassword, generateApiToken } = await import('@/lib/auth')
  const { parseBody, badRequest } = await import('@/lib/api-utils')
  const user = await getCurrentUser(request)
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const { username, password, role } = body as {
    username?: string
    password?: string
    role?: string
  }

  if (!username || !password) {
    return badRequest('username and password are required')
  }

  if (role && !['admin', 'user'].includes(role)) {
    return badRequest('role must be "admin" or "user"')
  }

  // Check duplicate
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return badRequest('Username already exists')
  }

  const hashedPassword = await hashPassword(password)
  const apiToken = generateApiToken()

  const newUser = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: role || 'user',
      apiToken,
    },
    select: {
      id: true,
      username: true,
      role: true,
      apiToken: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json(newUser, { status: 201 })
}
