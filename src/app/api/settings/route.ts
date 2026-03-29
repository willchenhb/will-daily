export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBody, badRequest } from '@/lib/api-utils'

const DEFAULTS: Record<string, string> = {
  ai_model: 'kimi-k2.5',
  ai_max_tokens: '1024',
}

export async function GET() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  })
  const result: Record<string, string> = { ...DEFAULTS }
  for (const s of settings) {
    result[s.key] = s.value
  }
  // Indicate whether KIMI_API_KEY is configured via env
  result.ai_api_key_set = process.env.KIMI_API_KEY ? 'true' : 'false'
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return badRequest('Invalid JSON body')

  const allowedKeys = ['ai_model', 'ai_max_tokens']

  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(body[key]) },
        create: { key, value: String(body[key]) },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
