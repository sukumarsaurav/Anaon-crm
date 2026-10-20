export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllotmentLetterData } from '@/lib/bookings/queries'
import AllotmentLetterView from '@/components/bookings/AllotmentLetterView'
import { ChevronLeft, Download } from 'lucide-react'

export const metadata = { title: 'Allotment Letter' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AllotmentLetterPage({ params }: PageProps) {
  const { id } = await params
  const data = await getAllotmentLetterData(id)
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
          Allotment Letter — {data.booking.booking_number} · {data.booking.client?.full_name}
        </p>
        <a
          href={`/api/documents/allotment/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download size={15} /> Download PDF
        </a>
      </div>
      <AllotmentLetterView data={data} />
    </div>
  )
}
