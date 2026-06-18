/**
 * Razorpay integration helpers.
 *
 * Env vars:
 *   RAZORPAY_KEY_ID         — public key id (also exposed to checkout)
 *   RAZORPAY_KEY_SECRET     — secret, server-only
 *   RAZORPAY_WEBHOOK_SECRET — secret configured on the Razorpay webhook
 */

import Razorpay from 'razorpay'
import crypto from 'crypto'

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

let _client: Razorpay | null = null
function client(): Razorpay {
  if (!_client) {
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _client
}

export interface CreateOrderInput {
  amountInRupees: number
  receipt: string
  notes?: Record<string, string>
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
}

/** Create a Razorpay order. Amount is converted to paise. */
export async function createOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  const order = await client().orders.create({
    amount: Math.round(input.amountInRupees * 100),
    currency: 'INR',
    receipt: input.receipt,
    notes: input.notes,
  })
  return { id: order.id, amount: Number(order.amount), currency: order.currency }
}

/**
 * Verify a Razorpay webhook signature (HMAC-SHA256 over the raw request body).
 * Returns false if the secret is unset so unverified events are rejected in prod.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
