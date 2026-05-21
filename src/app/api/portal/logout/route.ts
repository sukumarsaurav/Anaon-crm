import { NextResponse } from 'next/server'
import { logoutPortal } from '@/lib/portal/actions'

export async function POST() {
  await logoutPortal()
  return NextResponse.json({ success: true })
}
