export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest } from '@/lib/api-utils'
import { MAX_MATERIAL_SIZE, MATERIAL_LIST_SELECT, decodeHtml, extractTitle } from '@/lib/materials'

// GET /api/materials — metadata only, newest first
export async function GET() {
  const materials = await prisma.material.findMany({
    select: MATERIAL_LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ materials })
}

// POST /api/materials — multipart/form-data, one or more `file` fields (.html / .htm)
export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('请使用 multipart/form-data 上传文件')
  }

  const files = form.getAll('file').filter((f): f is File => typeof f !== 'string')
  if (files.length === 0) return badRequest('未找到上传文件（字段名 file）')

  const created = []
  const errors: string[] = []

  for (const file of files) {
    const name = file.name || 'untitled.html'
    if (!/\.html?$/i.test(name)) {
      errors.push(`${name}：仅支持 .html / .htm 文件`)
      continue
    }
    if (file.size > MAX_MATERIAL_SIZE) {
      errors.push(`${name}：超过 10MB 限制`)
      continue
    }

    const buf = new Uint8Array(await file.arrayBuffer())
    const content = decodeHtml(buf)
    if (!content.trim()) {
      errors.push(`${name}：文件内容为空`)
      continue
    }

    const title = (extractTitle(content) || name.replace(/\.html?$/i, '')).slice(0, 200)
    const material = await prisma.material.create({
      data: { title, filename: name, content, size: buf.byteLength },
      select: MATERIAL_LIST_SELECT,
    })
    created.push(material)
  }

  if (created.length === 0) {
    return NextResponse.json({ error: errors.join('；'), details: errors }, { status: 400 })
  }
  return NextResponse.json({ created, errors }, { status: 201 })
}
