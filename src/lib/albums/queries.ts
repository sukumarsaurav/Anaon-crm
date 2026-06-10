'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface AlbumListItem {
  id: string
  title: string
  share_token: string
  client_name: string | null
  is_active: boolean
  view_count: number
  last_viewed_at: string | null
  created_at: string
  project: { name: string } | null
  creator: { full_name: string } | null
}

/** CRM-side: list albums with project + creator names and view counts. */
export async function getAlbums(): Promise<AlbumListItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('property_albums')
    .select(`
      id, title, share_token, client_name, is_active, view_count, last_viewed_at, created_at,
      project:projects(name),
      creator:profiles!property_albums_created_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
  return (data as unknown as AlbumListItem[]) ?? []
}

export interface PublicAlbum {
  title: string
  client_name: string | null
  message: string | null
  created_by_name: string | null
  created_by_phone: string | null
  project: {
    name: string
    type: string
    city: string | null
    locality: string | null
    address: string | null
    description: string | null
    google_maps_pin: string | null
    layout_image_url: string | null
    brochure_url: string | null
    video_url: string | null
    expected_completion_date: string | null
    rera_number: string | null
    amenities: unknown
    gallery_urls: unknown
  } | null
  plots: Array<{
    plot_number: string
    configuration: string | null
    size_sqyd: number | null
    size_sqft: number | null
    facing: string | null
    total_price: number | null
    status: string
  }>
}

/**
 * Public-side: resolve an album by share token using the service client (no auth).
 * Returns null for missing/inactive albums.
 */
export async function getAlbumByToken(token: string): Promise<PublicAlbum | null> {
  const supabase = createServiceClient()

  const { data: album } = await supabase
    .from('property_albums')
    .select('title, client_name, message, plot_ids, project_id, created_by')
    .eq('share_token', token)
    .eq('is_active', true)
    .maybeSingle()
  if (!album) return null

  const [{ data: project }, { data: creator }] = await Promise.all([
    album.project_id
      ? supabase
          .from('projects')
          .select(
            'name, type, city, locality, address, description, google_maps_pin, layout_image_url, brochure_url, video_url, expected_completion_date, rera_number, amenities, gallery_urls',
          )
          .eq('id', album.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    album.created_by
      ? supabase.from('profiles').select('full_name, phone').eq('id', album.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Plots: curated selection if provided, else available plots for the project.
  let plots: PublicAlbum['plots'] = []
  if (album.project_id) {
    let pq = supabase
      .from('plots')
      .select('plot_number, configuration, size_sqyd, size_sqft, facing, total_price, status')
      .eq('project_id', album.project_id)
      .order('plot_number', { ascending: true })
    if (album.plot_ids?.length) {
      pq = pq.in('id', album.plot_ids)
    } else {
      pq = pq.eq('status', 'available')
    }
    const { data } = await pq.limit(100)
    plots = (data as PublicAlbum['plots']) ?? []
  }

  return {
    title: album.title,
    client_name: album.client_name,
    message: album.message,
    created_by_name: (creator as { full_name?: string } | null)?.full_name ?? null,
    created_by_phone: (creator as { phone?: string } | null)?.phone ?? null,
    project: (project as PublicAlbum['project']) ?? null,
    plots,
  }
}

/** Record a view (atomic increment + log) via the SECURITY DEFINER function. */
export async function recordAlbumView(token: string, userAgent: string | null, referrer: string | null) {
  const supabase = createServiceClient()
  await supabase.rpc('record_album_view', { p_token: token, p_ua: userAgent, p_ref: referrer })
}
