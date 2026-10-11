export const dynamic = 'force-dynamic'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest } from '@/lib/api-utils'
import { MAX_UPLOAD_SIZE, sniffImageType } from '@/lib/uploads'

// POST /api/uploads — multipart/form-data with a single `file` image; returns { url }
export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('请使用 multipart/form-data 上传图片')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') return badRequest('未找到上传图片（字段名 file）')
  if (file.size > MAX_UPLOAD_SIZE) return badRequest('图片超过 10MB 限制')

  const data = new Uint8Array(await file.arrayBuffer())
  const mime = sniffImageType(data)
  if (!mime) return badRequest('仅支持 PNG / JPEG / GIF / WebP 图片')

  const key = randomUUID()
  await prisma.upload.create({ data: { key, mime, size: data.byteLength, data } })

  return NextResponse.json({ url: `/api/uploads/${key}` }, { status: 201 })
}
