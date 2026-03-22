import { NextResponse } from 'next/server'

export function parseId(idStr: string): number | null {
  const id = parseInt(idStr)
  return isNaN(id) ? null : id
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
