import { world, resetWorld } from '../helpers/world'
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Allotment / demand letter downloads: staff only, and only for bookings the caller can read (the
 * fake client has no RLS, so "can't read" is a booking that isn't returned). A download must not
 * save the PDF or change the link the client portal shows.
 */
const BOOKING = '11111111-1111-4111-8111-111111111111'
const PAYMENT = '22222222-2222-4222-8222-222222222222'
const seed = (role: string | null, withRows = true) => resetWorld(withRows ? {
  bookings: [{ id: BOOKING, booking_number: 'BK-001', status: 'confirmed', allotment_letter_url: 'https://stored/original.pdf',
    client: { full_name: 'Ravi', phone: '9810001025' }, project: { name: 'Anon Heights' }, plot: { plot_number: 'A-12' } }],
  payments: [{ id: PAYMENT, booking_id: BOOKING, installment_number: 2, amount_due: 500000, due_date: '2026-11-01' }],
} : { bookings: [], payments: [] }, {}, role, 'u1')

const allotment = async () => (await import('@/app/api/documents/allotment/[bookingId]/route')).GET(
  new NextRequest(`http://localhost/api/documents/allotment/${BOOKING}`), { params: Promise.resolve({ bookingId: BOOKING }) })
const demand = async () => (await import('@/app/api/documents/demand/[paymentId]/route')).GET(
  new NextRequest(`http://localhost/api/documents/demand/${PAYMENT}`), { params: Promise.resolve({ paymentId: PAYMENT }) })

describe('booking document downloads', () => {
  it('signed out → 401', async () => {
    seed(null)
    expect((await allotment()).status).toBe(401)
    expect((await demand()).status).toBe(401)
  })
  it('a broker or portal login gets 404 (same as a missing booking)', async () => {
    seed('broker')
    expect((await allotment()).status).toBe(404)
    expect((await demand()).status).toBe(404)
  })
  it('staff who can\'t see the booking get 404', async () => {
    seed('sales_advisor', false)
    expect((await allotment()).status).toBe(404)
    expect((await demand()).status).toBe(404)
  })
  it('staff who can see it get the PDF, and nothing is saved or changed', async () => {
    seed('sales_advisor')
    const a = await allotment()
    expect(a.status).toBe(200)
    expect(a.headers.get('content-type')).toBe('application/pdf')
    expect((await demand()).status).toBe(200)
    expect(world.db.rows('bookings')[0].allotment_letter_url).toBe('https://stored/original.pdf')
    expect(world.db.log.filter((l) => l.op !== 'select')).toEqual([])
  }, 20_000)
})
