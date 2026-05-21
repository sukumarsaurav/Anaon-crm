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
    .select('id, full_name, phone, status, budget_min, budget_max, next_follow_up, assigned_to, created_at')
    .eq('is_active', true)
    .order('next_follow_up', { ascending: true, nullsFirst: false })
    .limit(100)

  if (myOnly) q = q.eq('assigned_to', user.id)
  if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
