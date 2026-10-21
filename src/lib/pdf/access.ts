import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

/**
 * Who may download a booking document (allotment / demand letter). The PDFs are built with the
 * service role, so the check happens here: staff only (brokers and portal clients have their own
 * screens), and the booking must be one the caller's own RLS lets them read — an advisor gets their
 * team's bookings, not every client's. Plain module.
 */
const STAFF = ['admin', 'manager', 'sales_advisor', 'telecaller']

export type DocAccess = { ok: true; userId: string } | { ok: false; status: 401 | 404 }

async function staff(): Promise<{ userId: string } | null | 'anon'> {
  const session = await getProfile()
  if (!session?.user) return 'anon'
  if (!session.profile || session.profile.is_active === false || !STAFF.includes(session.profile.role)) return null
  return { userId: session.user.id }
}

export async function canReadBooking(bookingId: string): Promise<DocAccess> {
  const who = await staff()
  if (who === 'anon') return { ok: false, status: 401 }
  // Not staff and "not yours" answer the same as "doesn't exist", so ids can't be probed.
  if (!who || !/^[0-9a-f-]{36}$/i.test(bookingId)) return { ok: false, status: 404 }
  const { data } = await (await createClient()).from('bookings').select('id').eq('id', bookingId).maybeSingle()
  return data ? { ok: true, userId: who.userId } : { ok: false, status: 404 }
}

export async function canReadPayment(paymentId: string): Promise<DocAccess> {
  const who = await staff()
  if (who === 'anon') return { ok: false, status: 401 }
  if (!who || !/^[0-9a-f-]{36}$/i.test(paymentId)) return { ok: false, status: 404 }
  const supabase = await createClient()
  const { data: payment } = await supabase.from('payments').select('booking_id').eq('id', paymentId).maybeSingle()
  if (!payment?.booking_id) return { ok: false, status: 404 }
  const { data: booking } = await supabase.from('bookings').select('id').eq('id', payment.booking_id).maybeSingle()
  return booking ? { ok: true, userId: who.userId } : { ok: false, status: 404 }
}
