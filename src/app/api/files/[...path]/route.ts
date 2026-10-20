import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPortalSession } from '@/lib/portal/session'
import { FILES_BUCKET, FILE_FOLDERS } from '@/lib/files/storage'

const STAFF = ['admin', 'manager', 'sales_advisor', 'telecaller']

/**
 * Opens a file from the private `crm-files` bucket. Staff can open any file; a client signed in to the
 * portal can open files under their own `clients/<id>/` folder. Everyone else gets 404, so the link
 * reveals nothing. Public in the proxy (portal clients have no Supabase session); access is checked here.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map((p) => decodeURIComponent(p))
  if (!parts.length || parts.some((p) => p === '..' || p === '.' || p.includes('/')) || !FILE_FOLDERS.includes(parts[0] as never)) {
    return new NextResponse('Not found', { status: 404 })
  }
  const path = parts.join('/')

  let allowed = false
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
    allowed = !!profile?.is_active && STAFF.includes(profile.role)
  }
  if (!allowed && parts[0] === 'clients') {
    const portal = await getPortalSession()
    allowed = !!portal && parts[1] === portal.client.id
  }
  if (!allowed) return new NextResponse('Not found', { status: 404 })

  const { data, error } = await createServiceClient().storage.from(FILES_BUCKET).createSignedUrl(path, 120)
  if (error || !data) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
