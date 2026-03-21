import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: { provider: string } }
) {
  return NextResponse.json(
    { error: `External provider '${params.provider}' sync not implemented` },
    { status: 501 }
  )
}
