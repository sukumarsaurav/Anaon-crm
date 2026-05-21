import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json([])

  const supabase = await createClient()
  const { data } = await supabase
    .from('plots')
    .select('id, plot_number, size_sqyd, size_sqft, type, facing, base_price, total_price, configuration')
    .eq('project_id', projectId)
    .in('status', ['available', 'soft_hold'])
    .order('plot_number')

  return NextResponse.json(data ?? [])
}
