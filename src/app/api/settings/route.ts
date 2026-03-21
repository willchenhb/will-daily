import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULTS: Record<string, string> = {
  ai_api_key: '',
  ai_model: 'moonshot-v1-32k',
  ai_max_tokens: '1024',
}

export async function GET() {
  const settings = await prisma.setting.findMany()
  const result: Record<string, string> = { ...DEFAULTS }
  for (const s of settings) {
    result[s.key] = s.value
  }
  // Mask API key for response
  if (result.ai_api_key) {
    const key = result.ai_api_key
    result.ai_api_key_masked = key.length > 8
      ? `${key.slice(0, 3)}****${key.slice(-4)}`
      : '****'
    result.ai_api_key_set = 'true'
  } else {
    result.ai_api_key_set = 'false'
  }
  delete result.ai_api_key
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const allowedKeys = ['ai_api_key', 'ai_model', 'ai_max_tokens']

  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: body[key] },
        create: { key, value: body[key] },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
