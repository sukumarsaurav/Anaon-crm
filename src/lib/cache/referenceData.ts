import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

/**
 * Cached reads of reference data that is identical for every user.
 *
 * Two constraints shape how this works:
 *
 * 1. `unstable_cache` cannot touch `cookies()`, so the request-scoped Supabase
 *    client can't be used inside it. These queries run with the **anon key**
 *    instead — deliberately, not as a shortcut. The `anon` RLS policy on
 *    `projects` is `is_active = true`, which is exactly the row set this
 *    dropdown wants, so the cache can never hold anything a signed-out visitor
 *    of the public site couldn't already read. A service-role client would have
 *    worked too but would bypass RLS for no benefit.
 *
 * 2. Only tables whose policies are user-independent belong here. `projects` is
 *    `true` for every authenticated user, so one cached copy is correct for
 *    all. Anything scoped per user or per team — leads, bookings, clients,
 *    payments, profiles — must never be cached this way: one user's rows would
 *    be served to another.
 *
 * Next 16 supersedes `unstable_cache` with the `use cache` directive, but that
 * requires the app-wide `cacheComponents` flag and Suspense boundaries on every
 * dynamic route, which is a migration of its own.
 */

export const PROJECTS_TAG = 'reference:projects'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export type ProjectOption = {
  id: string
  name: string
  city: string | null
  type: string | null
  status: string | null
}

/**
 * Active projects, for pickers and filters. Read on most lead screens and
 * previously re-queried on every one of them.
 */
export const getActiveProjectOptions = unstable_cache(
  async (): Promise<ProjectOption[]> => {
    const { data } = await anonClient()
      .from('projects')
      .select('id, name, city, type, status')
      .eq('is_active', true)
      .order('name')

    return (data ?? []) as ProjectOption[]
  },
  ['reference-active-projects'],
  { tags: [PROJECTS_TAG], revalidate: 300 },
)
