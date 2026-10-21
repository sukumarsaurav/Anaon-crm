import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import OpeningForm, { type Opening } from '@/components/hr/OpeningForm'
import ActionButton from '@/components/ui/ActionButton'
import { setListingActive } from '@/lib/hr/listings'

export const metadata = { title: 'Job Openings' }

export const dynamic = 'force-dynamic'

/** The website's careers page lists the active openings from here (GET /api/public/careers). */
export default async function OpeningsPage() {
  const supabase = await createClient()
  const [{ data }, { data: apps }] = await Promise.all([
    supabase.from('career_listings').select('*').order('is_active', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('career_applications').select('listing_id'),
  ])
  const openings = (data ?? []) as Opening[]
  const count = new Map<string, number>()
  for (const a of apps ?? []) if (a.listing_id) count.set(a.listing_id, (count.get(a.listing_id) ?? 0) + 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/recruitment" aria-label="Back to recruitment" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Job Openings</h1>
          <p className="text-sm text-slate-500">Active openings appear on the website’s careers page.</p>
        </div>
        <div className="ml-auto"><OpeningForm /></div>
      </div>

      {openings.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">No openings yet.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {openings.map((o) => (
            <div key={o.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{o.title}
                  {!o.is_active && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">closed</span>}
                </p>
                <p className="text-xs text-slate-500">{o.department} · {o.location} · {o.employment_type.replace('_', ' ')} · {count.get(o.id) ?? 0} applications</p>
              </div>
              <OpeningForm opening={o} />
              <ActionButton label={o.is_active ? 'Close' : 'Reopen'} tone={o.is_active ? 'danger' : 'success'}
                confirm={o.is_active ? 'Close this opening? It disappears from the website.' : undefined}
                action={setListingActive.bind(null, o.id, !o.is_active)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
