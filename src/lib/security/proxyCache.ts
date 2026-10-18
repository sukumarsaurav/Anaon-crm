import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Short-lived caches for the values `proxy.ts` needs on requests.
 *
 * Values here change rarely (global security policy; user role), so a short
 * TTL removes them from the hot path. The cost is bounded staleness: a policy
 * change takes effect within TTL_MS rather than instantly. `invalidateGate`
 * exists so role updates can drop a user's entry immediately instead of waiting.
 *
 * Caches live in module scope: per server instance, never shared across
 * processes, and empty again after a deploy or a cold start.
 */

const TTL_MS = 60_000
const MAX_GATE_ENTRIES = 500

type Entry<T> = { value: T; at: number }

const isFresh = (at: number) => Date.now() - at < TTL_MS

export type SecuritySettings = { ipWhitelistEnabled: boolean }
export type UserGate = { role: string | null }

let settingsEntry: Entry<SecuritySettings> | null = null
const gateEntries = new Map<string, Entry<UserGate>>()

export async function getSecuritySettings(
  supabase: SupabaseClient,
): Promise<SecuritySettings> {
  const cached = settingsEntry
  if (cached && isFresh(cached.at)) return cached.value

  const { data, error } = await supabase
    .from('security_settings')
    .select('ip_whitelist_enabled')
    .limit(1)
    .maybeSingle()

  // On error keep serving the last known value rather than failing open on a
  // transient blip; only fall back to "disabled" when nothing was ever cached.
  if (error) return cached?.value ?? { ipWhitelistEnabled: false }

  const value = { ipWhitelistEnabled: data?.ip_whitelist_enabled === true }
  settingsEntry = { value, at: Date.now() }
  return value
}

export async function getUserGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserGate> {
  const hit = gateEntries.get(userId)
  if (hit && isFresh(hit.at)) return hit.value

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) return hit?.value ?? { role: null }

  const value: UserGate = {
    role: data?.role ?? null,
  }

  // Cheap bound: drop expired entries, and if still at the cap drop the oldest.
  if (gateEntries.size >= MAX_GATE_ENTRIES) {
    for (const [k, v] of gateEntries) if (!isFresh(v.at)) gateEntries.delete(k)
    if (gateEntries.size >= MAX_GATE_ENTRIES) {
      const oldest = [...gateEntries.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) gateEntries.delete(oldest[0])
    }
  }

  gateEntries.set(userId, { value, at: Date.now() })
  return value
}

/** Drop a user's cached gate so a role change applies on their next request. */
export function invalidateGate(userId: string) {
  gateEntries.delete(userId)
}

/** Drop the cached security policy so an admin's change applies immediately. */
export function invalidateSecuritySettings() {
  settingsEntry = null
}
