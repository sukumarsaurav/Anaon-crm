import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Shared-secret helpers for unauthenticated endpoints (crons, webhooks).
 *
 * These used to be guarded by `process.env.X ?? 'anon_india_..._secret'`, so an
 * unset env var silently fell back to a constant committed to the public repo —
 * anyone could trigger the endpoint. Everything here fails CLOSED instead: no
 * configured secret means no access.
 */

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * True only when `provided` matches the secret in `envValue`. If the env var is
 * unset or empty, always false — the endpoint is closed until it is configured.
 */
export function matchesSecret(envValue: string | undefined, provided: string | null): boolean {
  if (!envValue || !provided) return false
  return safeEqual(envValue, provided)
}

/** `Authorization: Bearer <secret>` check that fails closed. */
export function checkBearer(authorizationHeader: string | null, envValue: string | undefined): boolean {
  if (!authorizationHeader?.startsWith('Bearer ')) return false
  return matchesSecret(envValue, authorizationHeader.slice(7))
}

/**
 * Verify an HMAC-SHA256 signature of the form `sha256=<hex>` (Meta/GitHub style)
 * over the raw request body. Fails closed when the secret is unset.
 */
export function verifyHmacSha256(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !signatureHeader) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signatureHeader)
}
