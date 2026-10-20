/** Core wiring: the fake database behind every Supabase import, plus the Next.js bits server code touches. */
import { vi } from 'vitest'
import { fakeDb, type Row, type FakeOptions } from './fakeSupabase'

export const world = {
  db: fakeDb(),
  session: null as null | { user: { id: string; email: string }; profile: { id: string; role: string; full_name: string; email: string; branch_id: null } },
  automations: [] as Array<{ trigger: string; ctx: any; recordType?: string; recordId?: string }>,
  notifications: [] as Array<{ ids: string[]; input: any }>,
}

// What the real tables default to (migrations), so rows created by the code behave like production rows.
const DEFAULTS = { leads: { is_active: true, follow_up_count: 0 }, profiles: { is_active: true }, plots: {}, whatsapp_conversations: { unread_count: 0 }, whatsapp_broadcast_recipients: { replied: false } }

export function resetWorld(seed: Record<string, Row[]> = {}, opts: FakeOptions = {}, role: string | null = 'admin', userId = 'user-admin') {
  world.db = fakeDb(seed, { defaults: DEFAULTS, ...opts })
  world.automations = []
  world.notifications = []
  world.session = role ? { user: { id: userId, email: `${role}@test`}, profile: { id: userId, role, full_name: role, email: `${role}@test`, branch_id: null } } : null
  return world.db
}

vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn, cache: (fn: any) => fn }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))
vi.mock('next/server', async () => {
  const actual = await vi.importActual<any>('next/server')
  return { ...actual, after: (p: any) => { void p } }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => world.db }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => world.db }))
vi.mock('@/lib/supabase/getProfile', () => ({ getProfile: async () => world.session }))
