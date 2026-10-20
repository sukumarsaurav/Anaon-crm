import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Validates the app's Bearer token and returns a client that acts AS that user, so RLS
 * (team hierarchy, own rows) applies exactly as in the web app. It used to return the
 * service client, which let any signed-in telecaller read every lead in the company
 * (`/api/mobile/leads?my_only=false`).
 */
export async function getMobileUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)
  const { data, error } = await serviceSupabase.auth.getUser(token)
  if (error || !data.user) return null

  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile?.is_active) return null
  // The mobile API is for field staff. Brokers also hold Supabase logins now; their tokens
  // must not work here.
  if (!['admin', 'manager', 'sales_advisor', 'telecaller'].includes(String(profile.role))) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  return { user: data.user, profile, supabase }
}
