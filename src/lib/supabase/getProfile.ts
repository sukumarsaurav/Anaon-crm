import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Current user + their profile row, deduplicated per request by `cache()`.
 *
 * Identity comes from `getClaims()`, which verifies the access token locally
 * with WebCrypto against a cached JWKS (this project signs with ES256). The
 * previous `getUser()` call made a network round-trip to the Auth server on
 * every render — and the proxy had already validated the same token moments
 * earlier, so it was paying that cost twice per page.
 *
 * Only `id` and `email` are read off `user` across the app, and both are
 * claims, so the returned shape is unchanged for callers.
 */
export const getProfile = cache(async () => {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) return null

  const user = { id: claims.sub as string, email: (claims.email as string) ?? null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, email, branch_id')
    .eq('id', user.id)
    .single()

  return { user, profile }
})
