import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import type { Client } from '@/types/clients'

/**
 * Resolves the current client-portal session from the `client_portal_session`
 * cookie via the `portal_check_session` RPC.
 *
 * Wrapped in React `cache()` so the layout and the page in a single render share
 * one lookup instead of each re-running the cookie read + RPC. (This lives in its
 * own module rather than `portal/queries.ts` because that file is `'use server'`,
 * where every export must be an async server action — a cached export is not.)
 */
export const getPortalSession = cache(async (): Promise<{ client: Client } | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('client_portal_session')?.value
  if (!token) return null

  // service_role: portal_check_session is not executable by anon (see portal/actions.ts).
  const { data } = await createServiceClient().rpc('portal_check_session', { p_token: token })
  if (!data) return null
  return { client: data as Client }
})
