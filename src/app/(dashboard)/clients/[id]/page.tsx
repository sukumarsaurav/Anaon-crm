export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getClientById, getClientBookings, getClientDocuments,
  getClientComplaints, getClientTimeline, getPaymentSummary,
} from '@/lib/clients/queries'
import { createClient as createSupabase } from '@/lib/supabase/server'
import { formatDate, formatCurrency } from '@/lib/utils'
import { OCCUPATION_LABELS } from '@/types/clients'
import KycStatusBadge from '@/components/clients/KycStatusBadge'
import KycChecklist from '@/components/clients/KycChecklist'
import BookingSummaryCard from '@/components/clients/BookingSummaryCard'
import ClientDocumentList from '@/components/clients/ClientDocumentList'
import ComplaintBoard from '@/components/clients/ComplaintBoard'
import CommunicationTimeline from '@/components/clients/CommunicationTimeline'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { Edit, Phone, Mail, MapPin, Briefcase, User } from 'lucide-react'

interface PageProps {
  params:      Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { key: 'overview',    label: 'Overview'   },
  { key: 'payments',    label: 'Payments'   },
  { key: 'documents',   label: 'Documents'  },
  { key: 'complaints',  label: 'Complaints' },
  { key: 'timeline',    label: 'Timeline'   },
]

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const { id }  = await params
  const { tab } = await searchParams
  const activeTab = tab ?? 'overview'

  const client = await getClientById(id)
  if (!client) notFound()

  const supabase = await createSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const canManage = ['admin', 'manager'].includes(profile?.role ?? '')

  const [bookings, documents, complaints, timeline] = await Promise.all([
    getClientBookings(id),
    getClientDocuments(id),
    getClientComplaints(id),
    activeTab === 'timeline' ? getClientTimeline(id) : Promise.resolve([]),
  ])

  // Payment summaries per booking
  const summaries = await Promise.all(bookings.map((b) => getPaymentSummary(b.id)))
  const summaryMap = Object.fromEntries(bookings.map((b, i) => [b.id, summaries[i]]))

  const initials = client.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const openComplaints = complaints.filter((c) => c.status !== 'resolved').length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        backHref="/clients"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base shrink-0">
              {client.photo_url
                ? <img src={client.photo_url} alt={client.full_name} className="w-full h-full rounded-full object-cover" />
                : initials}
            </span>
            <span>{client.full_name}</span>
            <KycStatusBadge status={client.kyc_status} />
          </span>
        }
        subtitle={
          <span className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex items-center gap-1"><Phone size={14} /> {client.phone}</span>
            {client.email && <span className="inline-flex items-center gap-1"><Mail size={14} /> {client.email}</span>}
          </span>
        }
        actions={
          canManage ? (
            <Button href={`/clients/${id}/edit`} size="sm">
              <Edit size={16} /> Edit
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.key === 'complaints' && openComplaints > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                {openComplaints}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Profile info */}
            <Card padding="md">
              <h3 className="font-semibold text-slate-900 mb-4">Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {client.date_of_birth && (
                  <div>
                    <p className="text-xs text-slate-500">Date of Birth</p>
                    <p className="font-medium text-slate-800">{formatDate(client.date_of_birth)}</p>
                  </div>
                )}
                {client.pan_encrypted && (
                  <div>
                    <p className="text-xs text-slate-500">PAN</p>
                    <p className="font-medium text-slate-800 font-mono">{client.pan_encrypted}</p>
                  </div>
                )}
                {client.occupation_type && (
                  <div>
                    <p className="text-xs text-slate-500">Occupation</p>
                    <p className="font-medium text-slate-800">
                      {OCCUPATION_LABELS[client.occupation_type]}
                      {client.company_name ? ` — ${client.company_name}` : ''}
                    </p>
                  </div>
                )}
                {client.annual_income && (
                  <div>
                    <p className="text-xs text-slate-500">Annual Income</p>
                    <p className="font-medium text-slate-800">{formatCurrency(client.annual_income)}</p>
                  </div>
                )}
                {client.permanent_address && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> Address</p>
                    <p className="font-medium text-slate-800">{client.permanent_address}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Co-applicant */}
            {client.co_applicant_name && (
              <Card padding="md">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <User size={18} /> Co-applicant
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-medium text-slate-800">{client.co_applicant_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Relationship</p>
                    <p className="font-medium text-slate-800">{client.co_applicant_relationship ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="font-medium text-slate-800">{client.co_applicant_phone ?? '—'}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Bookings */}
            {bookings.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Briefcase size={18} /> Bookings ({bookings.length})
                </h3>
                <div className="space-y-4">
                  {bookings.map((b) => (
                    <BookingSummaryCard key={b.id} booking={b} summary={summaryMap[b.id]} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <KycChecklist client={client} canManage={canManage} />

            {/* Nominee */}
            {client.nominee_name && (
              <Card padding="md">
                <h3 className="font-semibold text-slate-900 mb-3">Nominee</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-medium text-slate-800">{client.nominee_name}</p>
                  </div>
                  {client.nominee_relationship && (
                    <div>
                      <p className="text-xs text-slate-500">Relationship</p>
                      <p className="font-medium text-slate-800">{client.nominee_relationship}</p>
                    </div>
                  )}
                  {client.nominee_dob && (
                    <div>
                      <p className="text-xs text-slate-500">Date of Birth</p>
                      <p className="font-medium text-slate-800">{formatDate(client.nominee_dob)}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          {bookings.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No bookings — no payment schedule</p>
          ) : (
            bookings.map((b) => (
              <div key={b.id}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">
                    {b.booking_number} — {b.project?.name} · Plot {b.plot?.plot_number}
                  </h3>
                </div>
                <Button
                  href={`/clients/${id}/bookings/${b.id}/payments`}
                  variant="outline"
                  className="w-full mb-2"
                >
                  Open Full Payment Schedule →
                </Button>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Due',    value: formatCurrency(summaryMap[b.id]?.total_due ?? 0)   },
                    { label: 'Paid',         value: formatCurrency(summaryMap[b.id]?.total_paid ?? 0)  },
                    { label: 'Outstanding',  value: formatCurrency(summaryMap[b.id]?.outstanding ?? 0) },
                    { label: 'Overdue',      value: `${summaryMap[b.id]?.overdue_count ?? 0} inst.`   },
                  ].map((s) => (
                    <Card key={s.label} padding="sm" className="text-center">
                      <p className="text-lg font-bold text-slate-800">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <ClientDocumentList clientId={id} documents={documents} canManage={canManage} />
      )}

      {activeTab === 'complaints' && (
        <ComplaintBoard
          clientId={id}
          bookings={bookings.map((b) => ({ id: b.id, booking_number: b.booking_number }))}
          complaints={complaints}
          canManage={canManage}
        />
      )}

      {activeTab === 'timeline' && (
        <Card padding="md">
          <h3 className="font-semibold text-slate-900 mb-5">Communication History</h3>
          <CommunicationTimeline events={timeline} />
        </Card>
      )}
    </div>
  )
}
