import { NextRequest, NextResponse } from 'next/server'
import { buildAllotmentForBooking } from '@/lib/pdf/builders'
import { canReadBooking } from '@/lib/pdf/access'

/** Staff download of a booking's allotment letter (rendered, not saved — see buildAllotmentForBooking). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params
  const access = await canReadBooking(bookingId)
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Unauthorized' : 'Booking not found' }, { status: access.status })

  const pdf = await buildAllotmentForBooking(bookingId, { store: false })
  if (!pdf) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdf.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
