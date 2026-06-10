export const revalidate = 60

import { getCareerListings, getCareerApplications } from '@/lib/website/queries'
import { EMPLOYMENT_TYPES } from '@/types/website'
import { formatDate } from '@/lib/utils'
import CareerActions from '@/components/website/CareerActions'
import CareerForm from '@/components/website/CareerForm'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'

const APP_STATUS_CONFIG = {
  new:    { label: 'new',    color: 'text-amber-700', bg: 'bg-amber-50' },
  other:  { label: 'other',  color: 'text-slate-500', bg: 'bg-slate-100' },
}

export default async function CareersManagementPage() {
  const [listings, applications] = await Promise.all([
    getCareerListings(),
    getCareerApplications(),
  ])

  const newApps = applications.filter((a) => a.status === 'new').length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Career Listings"
        subtitle={
          <>
            {listings.filter((l) => l.is_active).length} active listings · {applications.length} applications
            {newApps > 0 && <span className="ml-2 text-amber-600 font-medium">({newApps} new)</span>}
          </>
        }
      />

      {/* Add listing */}
      <CareerForm />

      {/* Listings */}
      {listings.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Active Listings</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {listings.map((job) => {
              const appCount = applications.filter((a) => a.listing_id === job.id).length
              const typeLabel = EMPLOYMENT_TYPES.find((t) => t.value === job.employment_type)?.label ?? job.employment_type
              return (
                <div key={job.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${job.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      <p className="font-semibold text-slate-900 text-sm">{job.title}</p>
                    </div>
                    <p className="text-xs text-slate-400 ml-4">
                      {job.department} · {job.location} · {typeLabel} · {formatDate(job.created_at)}
                      {appCount > 0 && ` · ${appCount} application${appCount > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <CareerActions listingId={job.id} isActive={job.is_active} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Applications */}
      {applications.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Recent Applications</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {applications.slice(0, 20).map((app) => {
              const cfg = app.status === 'new'
                ? APP_STATUS_CONFIG.new
                : { ...APP_STATUS_CONFIG.other, label: app.status }
              return (
                <div key={app.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{app.name}</p>
                      <p className="text-xs text-slate-400">
                        {app.phone}{app.email && ` · ${app.email}`}
                        {app.listing && ` · for ${app.listing.title}`}
                        {` · ${formatDate(app.created_at)}`}
                      </p>
                      {app.cover_letter && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{app.cover_letter}</p>
                      )}
                    </div>
                    <StatusBadge config={cfg} size="sm" className="shrink-0" />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
