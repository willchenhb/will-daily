export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseId, parseBody, badRequest, notFound } from '@/lib/api-utils'
import { MATERIAL_LIST_SELECT } from '@/lib/materials'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const material = await prisma.material.findUnique({ where: { id }, select: MATERIAL_LIST_SELECT })
  if (!material) return notFound('Material not found')
  return NextResponse.json(material)
}

// PUT — update title / description
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id)
  if (id === null) return badRequest('Invalid id')

  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const data: { title?: string; description?: string | null } = {}
  if (body.title !== undefined) {
    const title = String(body.title ?? '').trim()
    if (!title) return badRequest('标题不能为空')
    data.title = title.slice(0, 200)
  }
  if (body.description !== undefined) {
    const description = String(body.description ?? '').trim()
    data.description = description ? description.slice(0, 1000) : null
  }

  try {
    const material = await prisma.material.update({ where: { id }, data, select: MATERIAL_LIST_SELECT })
    return NextResponse.json(material)
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Material not found')
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
    await prisma.material.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return notFound('Material not found')
    }
    throw e
  }
}
