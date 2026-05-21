import { NextRequest, NextResponse } from 'next/server'
import { verifyPortalOtp } from '@/lib/portal/actions'

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json()
    if (!phone || !otp) return NextResponse.json({ error: 'Phone and OTP required' }, { status: 400 })

    const result = await verifyPortalOtp(phone, otp)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
