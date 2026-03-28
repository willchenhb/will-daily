import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isAdmin, generateApiToken } from '@/lib/auth'
import { badRequest, notFound } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    select: {
      id: true,
      username: true,
      apiToken: true,
    },
  })

  return NextResponse.json(updated)
}
