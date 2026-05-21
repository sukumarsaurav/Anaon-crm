import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
  return { user: data.user, profile, supabase: serviceSupabase }
}
