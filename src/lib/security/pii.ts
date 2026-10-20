import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Field-level encryption for government IDs (PAN, Aadhaar).
 *
 * The columns are called `pan_encrypted` / `aadhar_encrypted`, but the app used to write the raw
 * number into them. Values are now AES-256-GCM: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url).
 * Legacy plaintext rows still read fine (anything without the prefix is returned as-is) and are
 * encrypted the next time the client is saved.
 *
 * Key: PII_ENCRYPTION_KEY — 32 bytes as 64 hex chars or base64. Generate: `openssl rand -hex 32`.
 * Losing the key makes stored IDs unreadable, so keep it with the other production secrets.
 */

const PREFIX = 'enc:v1:'

function key(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  return buf.length === 32 ? buf : null
}

export function piiConfigured(): boolean {
  return key() !== null
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX)
}

/** Encrypts a non-empty value; empty input stays null. Throws if no valid key is configured. */
export function encryptPii(plain: string | null | undefined): string | null {
  const v = plain?.trim()
  if (!v) return null
  if (isEncrypted(v)) return v // already encrypted (e.g. a form echoing a stored value)
  const k = key()
  if (!k) throw new Error('PII_ENCRYPTION_KEY is not set — PAN / Aadhaar cannot be stored safely')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const data = Buffer.concat([cipher.update(v, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`
}

/** Plain text for an encrypted value; legacy plaintext passes through; null on a wrong key / bad data. */
export function decryptPii(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (!isEncrypted(stored)) return stored
  const k = key()
  if (!k) return null
  try {
    const [iv, tag, data] = stored.slice(PREFIX.length).split(':')
    const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** For display: decrypts, then hides all but the last 4 characters. */
export function displayPii(stored: string | null | undefined, visible = 4): string {
  const plain = decryptPii(stored)
  if (!plain) return stored && isEncrypted(stored) ? '••••••' : ''
  if (plain.length <= visible) return plain
  return '•'.repeat(Math.max(plain.length - visible, 4)) + plain.slice(-visible)
}
