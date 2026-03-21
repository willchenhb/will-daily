import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { provider: string } }
) {
  return NextResponse.json(
    { error: `External provider '${params.provider}' not implemented` },
    { status: 501 }
  )
}
