import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'

export async function GET(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, supabase } = auth
  const url = new URL(req.url)
  const myOnly = url.searchParams.get('my_only') !== 'false'
  const search = url.searchParams.get('search') ?? ''

  let q = supabase
    .from('leads')
    // Aliased to the field names the mobile app was built against.
    .select('id, full_name, phone, status:stage, budget_min, budget_max, next_follow_up:next_followup_at, assigned_to, created_at')
    .eq('is_active', true)
    .order('next_followup_at', { ascending: true, nullsFirst: false })
    .limit(100)

  if (myOnly) q = q.eq('assigned_to', user.id)
  // Commas, parentheses and dots are PostgREST filter syntax; letting them through lets
  // the caller append conditions of their own.
  const term = search.replace(/[^\p{L}\p{N}\s+@-]/gu, '').trim()
  if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
