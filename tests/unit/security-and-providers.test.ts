import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { safeEqual, matchesSecret, checkBearer, verifyHmacSha256 } from '@/lib/security/secrets'
import { verifyWebhookSignature } from '@/lib/payments/razorpay'
import { toMsg91Mobile, sendSms } from '@/lib/messaging/sms'
import { toE164 } from '@/lib/telephony/exotel'
import { esc, receiptEmail, genericEmail, bookingConfirmationEmail, kycStatusEmail, demandEmail } from '@/lib/email/templates'
import { normalizePhone } from '@/lib/leads/ingest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/automation/engine', () => ({ fireAutomations: () => Promise.resolve() }))
vi.mock('@/lib/notifications/notify', () => ({ notifyUsers: async () => {} }))

describe('shared-secret helpers fail closed', () => {
  it('safeEqual never throws on length mismatch', () => {
    expect(safeEqual('a', 'abc')).toBe(false)
    expect(safeEqual('abc', 'abc')).toBe(true)
  })
  it('an unset or empty secret rejects everything', () => {
    expect(matchesSecret(undefined, 'x')).toBe(false)
    expect(matchesSecret('', '')).toBe(false)
    expect(matchesSecret('s', null)).toBe(false)
    expect(matchesSecret('s', 's')).toBe(true)
  })
  it('bearer check', () => {
    expect(checkBearer('Bearer s', 's')).toBe(true)
    expect(checkBearer('Bearer x', 's')).toBe(false)
    expect(checkBearer('s', 's')).toBe(false)
    expect(checkBearer(null, 's')).toBe(false)
    expect(checkBearer('Bearer s', undefined)).toBe(false)
  })
  it('hmac sha256', () => {
    const sig = 'sha256=' + createHmac('sha256', 'k').update('body').digest('hex')
    expect(verifyHmacSha256('body', sig, 'k')).toBe(true)
    expect(verifyHmacSha256('body2', sig, 'k')).toBe(false)
    expect(verifyHmacSha256('body', sig, undefined)).toBe(false)
  })
})

describe('razorpay webhook signature', () => {
  const sign = (b: string) => createHmac('sha256', 'rzp-secret').update(b).digest('hex')
  it('accepts a valid signature, rejects wrong/missing/short ones', () => {
    expect(verifyWebhookSignature('{"a":1}', sign('{"a":1}'))).toBe(true)
    expect(verifyWebhookSignature('{"a":2}', sign('{"a":1}'))).toBe(false)
    expect(verifyWebhookSignature('{"a":1}', null)).toBe(false)
    expect(verifyWebhookSignature('{"a":1}', 'abc')).toBe(false)
  })
})

describe('phone helpers', () => {
  it('normalizePhone (lead ingest)', () => {
    expect(normalizePhone('+91 98100-01025')).toBe('9810001025')
    expect(normalizePhone('09810001025')).toBe('9810001025')
    expect(normalizePhone('919810001025')).toBe('9810001025')
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
  it('MSG91 and Exotel formats', () => {
    expect(toMsg91Mobile('9810001025')).toBe('919810001025')
    expect(toMsg91Mobile('+919810001025')).toBe('919810001025')
    expect(toE164('9810001025')).toBe('+919810001025')
    expect(toE164('919810001025')).toBe('+919810001025')
  })
})

describe('sms provider', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it('refuses to send when unconfigured', async () => {
    vi.stubEnv('MSG91_AUTH_KEY', '')
    expect((await sendSms('9810001025', { OTP: '1' })).success).toBe(false)
  })
  it('posts a flow request and surfaces provider errors', async () => {
    vi.stubEnv('MSG91_AUTH_KEY', 'k'); vi.stubEnv('MSG91_OTP_TEMPLATE_ID', 't')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'success' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect((await sendSms('9810001025', { OTP: '123456' })).success).toBe(true)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.recipients[0]).toMatchObject({ mobiles: '919810001025', OTP: '123456' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'error', message: 'DLT' }) }))
    expect(await sendSms('9810001025', { OTP: '1' })).toEqual({ success: false, error: 'DLT' })
  })
})

describe('email templates escape user data', () => {
  const evil = '<img src=x onerror=alert(1)>'
  it('esc', () => expect(esc(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;'))
  it('no template lets markup through', () => {
    const outs = [
      receiptEmail({ name: evil, bookingNumber: evil, installment: 1, amount: evil, date: evil, reference: evil }).html,
      demandEmail({ name: evil, bookingNumber: evil, installment: 1, amount: evil, dueDate: evil, portalUrl: '"><script>x</script>' }).html,
      bookingConfirmationEmail({ name: evil, bookingNumber: evil, project: evil, unit: evil, totalValue: evil }).html,
      kycStatusEmail({ name: evil, status: evil }).html,
      genericEmail(evil, evil).html,
    ]
    for (const html of outs) { expect(html).not.toContain('<img src=x'); expect(html).not.toContain('<script>') }
  })
  it('subjects stay plain text (not HTML-escaped)', () => {
    expect(receiptEmail({ name: 'A', bookingNumber: 'BK-1 & 2', installment: 2, amount: '1', date: 'd', reference: 'r' }).subject).toBe('Payment Receipt · BK-1 & 2 · Installment #2')
  })
})
