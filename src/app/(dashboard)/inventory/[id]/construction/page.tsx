export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectMilestones, getConstructionLinkedBookings } from '@/lib/construction/queries'
import { getConstructionUpdates } from '@/lib/portal/queries'
import { formatDate } from '@/lib/utils'
import { Eye, EyeOff, Users, IndianRupee } from 'lucide-react'
import MilestoneTimeline from '@/components/construction/MilestoneTimeline'
import BulkMilestoneSetup from '@/components/construction/BulkMilestoneSetup'
import AddMilestoneForm from '@/components/construction/AddMilestoneForm'
import ConstructionUpdateForm from '@/components/inventory/ConstructionUpdateForm'
import ConstructionUpdateActions from '@/components/inventory/ConstructionUpdateActions'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import EmptyState from '@/components/ui/EmptyState'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ConstructionPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, milestones, updates, linkedBookings] = await Promise.all([
    supabase.from('projects').select('id, name, city, type, status').eq('id', id).single(),
    getProjectMilestones(id),
    getConstructionUpdates(id),
    getConstructionLinkedBookings(id),
  ])

  if (!project) notFound()

  const completedPaymentMilestones = milestones.filter(
    (m) => m.status === 'completed' && m.is_payment_trigger && m.payment_percentage > 0
  )

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Construction Progress"
        subtitle={`${project.name} · ${project.city}`}
        backHref={`/inventory/${id}`}
        actions={
          linkedBookings.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Users size={14} />
              {linkedBookings.length} construction-linked {linkedBookings.length === 1 ? 'booking' : 'bookings'}
            </div>
          ) : undefined
        }
      />

      {/* Demand letter alert */}
      {completedPaymentMilestones.length > 0 && linkedBookings.length > 0 && (
        <Alert variant="warning" title="Demand Letters Pending" icon={<IndianRupee size={18} />}>
          {completedPaymentMilestones.map((m) => m.name).join(', ')} completed —{' '}
          {linkedBookings.length} client{linkedBookings.length > 1 ? 's' : ''} on construction-linked plan
          should receive demand letters. Go to Bookings to generate them.
        </Alert>
      )}

      {/* ── SECTION 1: Milestones ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Milestones</h2>
          {milestones.length > 0 && <AddMilestoneForm projectId={id} />}
        </div>

        {milestones.length === 0 ? (
          <BulkMilestoneSetup projectId={id} />
        ) : (
          <MilestoneTimeline milestones={milestones} projectId={id} />
        )}

      </section>

      {/* ── SECTION 2: Client Updates ── */}
      <section className="space-y-4 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Client Updates</h2>
        <p className="text-xs text-slate-400 -mt-2">Published updates are visible to clients in the portal.</p>

        <ConstructionUpdateForm projectId={id} />

        {updates.length > 0 && (
          <div className="space-y-3">
            {updates.map((u) => (
              <Card key={u.id} padding="md">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-slate-900 text-sm">{u.title}</h4>
                      {u.is_published
                        ? <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200"><Eye size={14} /> Published</span>
                        : <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full"><EyeOff size={14} /> Draft</span>
                      }
                    </div>
                    <p className="text-xs text-slate-400">
                      {formatDate(u.update_date)}
                      {u.milestone && ` · ${u.milestone}`}
                      {u.poster && ` · by ${u.poster.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-2xl font-bold text-indigo-600">{u.percentage_complete}%</span>
                    <ConstructionUpdateActions updateId={u.id} projectId={id} isPublished={u.is_published} />
                  </div>
                </div>
                {u.description && <p className="text-sm text-slate-600 mb-3">{u.description}</p>}
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${u.percentage_complete}%` }} />
                </div>
                {u.photos && u.photos.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {u.photos.map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${idx + 1}`}
                          className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {updates.length === 0 && (
          <EmptyState
            bordered
            title="No client updates posted yet"
          />
        )}
      </section>
    </div>
  )
}
