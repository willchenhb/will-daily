export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'

export async function POST() {
  await clearSession()
  const response = NextResponse.json({ success: true })
  response.cookies.delete('will-daily-session')
  return response
}
