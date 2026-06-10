import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getProfile = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, email, branch_id')
    .eq('id', user.id)
    .single()

  return { user, profile }
})
