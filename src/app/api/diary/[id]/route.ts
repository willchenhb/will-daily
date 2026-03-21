import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const body = await request.json()

  const entry = await prisma.diaryEntry.update({
    where: { id },
    data: { content: body.content },
  })

  return NextResponse.json(entry)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  await prisma.diaryEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
