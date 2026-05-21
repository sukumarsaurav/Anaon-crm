export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDemandLetterData } from '@/lib/bookings/queries'
import DemandLetterView from '@/components/bookings/DemandLetterView'
import { ChevronLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string; paymentId: string }>
}

export default async function DemandLetterPage({ params }: PageProps) {
  const { id, paymentId } = await params
  const data = await getDemandLetterData(id, paymentId)
  if (!data) notFound()

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 flex items-center gap-3">
        <Link
          href={`/bookings/${id}`}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Back to booking"
        >
          <ChevronLeft size={18} />
        </Link>
        <p className="text-sm text-slate-600">
          Demand Letter — Installment #{data.payment.installment_number} · {data.booking.client?.full_name}
        </p>
      </div>
      <DemandLetterView data={data} />
    </div>
  )
}
