import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/** Open positions for the public website (HR → Recruitment → Openings is the source). Cached 5 minutes. */
export const revalidate = 300

export async function GET() {
  const { data, error } = await createServiceClient()
    .from('career_listings')
    .select('id, title, department, employment_type, location, description, requirements, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unavailable' }, { status: 500 })
  return NextResponse.json({ listings: data ?? [] }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_WEBSITE_URL || '*',
    },
  })
}
