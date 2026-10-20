import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClientProfile, updateClientProfile } from '@/lib/clients/actions'
import { decryptPii } from '@/lib/security/pii'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }

describe('client profile and government IDs', () => {
  beforeEach(() => { vi.stubEnv('PII_ENCRYPTION_KEY', 'c'.repeat(64)); resetWorld({ clients: [] }, {}, 'sales_advisor', 'adv') })

  it('stores PAN and Aadhaar encrypted, never plain', async () => {
    const r: any = await createClientProfile(fd({ full_name: 'Sita', phone: '9810001025', pan: 'ABCDE1234F', aadhar: '1234 5678 9012' }))
    expect(r.success).toBe(true)
    const c = world.db.rows('clients')[0]
    expect(c.pan_encrypted).toMatch(/^enc:v1:/)
    expect(c.pan_encrypted).not.toContain('ABCDE')
    expect(decryptPii(c.aadhar_encrypted)).toBe('1234 5678 9012')
  })
  it('without a key it refuses to save an ID rather than storing plaintext', async () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', '')
    const r: any = await createClientProfile(fd({ full_name: 'Sita', phone: '9810001025', pan: 'ABCDE1234F' }))
    expect(r.success).toBe(false)
    expect(world.db.rows('clients')).toHaveLength(0)
    // but a client with no ID is fine
    expect(((await createClientProfile(fd({ full_name: 'Sita', phone: '9810001025' }))) as any).success).toBe(true)
  })
  it('editing re-encrypts, and clearing the field clears it', async () => {
    await createClientProfile(fd({ full_name: 'Sita', phone: '9810001025', pan: 'ABCDE1234F' }))
    const id = world.db.rows('clients')[0].id
    await updateClientProfile(id, fd({ full_name: 'Sita D', phone: '9810001025', pan: 'ZZZZZ9999Z' }))
    expect(decryptPii(world.db.rows('clients')[0].pan_encrypted)).toBe('ZZZZZ9999Z')
    await updateClientProfile(id, fd({ full_name: 'Sita D', phone: '9810001025', pan: '' }))
    expect(world.db.rows('clients')[0].pan_encrypted).toBeNull()
  })
  it('requires a session', async () => {
    resetWorld({}, {}, null)
    expect(((await createClientProfile(fd({ full_name: 'x', phone: '1' }))) as any).success).toBe(false)
  })
})
