export const dynamic = 'force-dynamic'

import { getAlbums } from '@/lib/albums/queries'
import { getProjects } from '@/lib/leads/queries'
import PageHeader from '@/components/ui/PageHeader'
import AlbumsManager from '@/components/albums/AlbumsManager'

export default async function AlbumsPage() {
  const [albums, projects] = await Promise.all([getAlbums(), getProjects()])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Property Albums"
        subtitle="Branded, shareable property pages you can send clients — with open-tracking"
      />
      <AlbumsManager
        albums={albums}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        appUrl={appUrl}
      />
    </div>
  )
}
