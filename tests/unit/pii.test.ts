import { describe, it, expect, afterEach, vi } from 'vitest'
import { encryptPii, decryptPii, displayPii, isEncrypted, piiConfigured } from '@/lib/security/pii'

const KEY = 'a'.repeat(64)
afterEach(() => vi.unstubAllEnvs())

describe('PAN / Aadhaar encryption', () => {
  it('round-trips and never stores the plain value', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    const enc = encryptPii('ABCDE1234F')!
    expect(isEncrypted(enc)).toBe(true)
    expect(enc).not.toContain('ABCDE')
    expect(decryptPii(enc)).toBe('ABCDE1234F')
  })
  it('uses a fresh IV every time (same input, different ciphertext)', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    expect(encryptPii('ABCDE1234F')).not.toBe(encryptPii('ABCDE1234F'))
  })
  it('empty input stays null; encrypting twice is a no-op', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    expect(encryptPii('  ')).toBeNull()
    expect(encryptPii(null)).toBeNull()
    const enc = encryptPii('X123')!
    expect(encryptPii(enc)).toBe(enc)
  })
  it('refuses to store an ID without a key (never silently plaintext)', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', '')
    expect(piiConfigured()).toBe(false)
    expect(() => encryptPii('ABCDE1234F')).toThrow(/PII_ENCRYPTION_KEY/)
    expect(encryptPii('')).toBeNull() // clearing a field needs no key
  })
  it('a wrong key or tampered data decrypts to null, not garbage', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    const enc = encryptPii('ABCDE1234F')!
    vi.stubEnv('PII_ENCRYPTION_KEY', 'b'.repeat(64))
    expect(decryptPii(enc)).toBeNull()
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    expect(decryptPii(enc.slice(0, -3) + 'AAA')).toBeNull()
  })
  it('legacy plaintext rows still read', () => {
    expect(decryptPii('ABCDE1234F')).toBe('ABCDE1234F')
    expect(decryptPii(null)).toBeNull()
  })
  it('display masks all but the last four characters', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', KEY)
    expect(displayPii(encryptPii('ABCDE1234F'))).toBe('••••••234F')
    expect(displayPii('ABCDE1234F')).toBe('••••••234F') // legacy plaintext is masked too
    expect(displayPii(null)).toBe('')
    expect(displayPii('ab')).toBe('ab')
  })
  it('accepts a base64 key as well as hex', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    expect(decryptPii(encryptPii('Z9')!)).toBe('Z9')
  })
})
