'use client'

import { Download } from 'lucide-react'

interface Props {
  reportType: string
  from?: string
  to?: string
  label?: string
}

export default function ExportButton({ reportType, from, to, label = 'Export CSV' }: Props) {
  function handleClick() {
    const params = new URLSearchParams({ type: reportType })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    window.open(`/api/reports/export?${params.toString()}`, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-2 text-xs border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300"
    >
      <Download size={13} />
      {label}
    </button>
  )
}
