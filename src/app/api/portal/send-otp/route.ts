import { NextRequest, NextResponse } from 'next/server'
import { sendPortalOtp } from '@/lib/portal/actions'

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const result = await sendPortalOtp(phone)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ success: true, otp: result.otp })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
