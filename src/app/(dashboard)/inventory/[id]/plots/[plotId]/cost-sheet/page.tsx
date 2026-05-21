export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCostSheet } from '@/lib/inventory/queries'
import CostSheetView from '@/components/inventory/CostSheetView'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string; plotId: string }>
}

export default async function CostSheetPage({ params }: PageProps) {
  const { id, plotId } = await params
  const costSheet = await getCostSheet(plotId)
  if (!costSheet) notFound()

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="print:hidden p-4 bg-white border-b border-slate-200 flex items-center gap-3">
        <Link href={`/inventory/${id}`} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <p className="text-sm text-slate-600">
          Cost Sheet — Plot {costSheet.plot.plot_number} · {costSheet.project.name}
        </p>
      </div>
      <CostSheetView data={costSheet} />
    </div>
  )
}
