'use client'

import { useState } from 'react'
import { X, UserCheck, Download } from 'lucide-react'
import Button from '@/components/ui/Button'
import { bulkAssignLeads } from '@/lib/leads/actions'
import { createClient } from '@/lib/supabase/client'

interface BulkActionsBarProps {
  selectedIds: string[]
  advisors: { id: string; full_name: string }[]
  onClear: () => void
}

export default function BulkActionsBar({ selectedIds, advisors, onClear }: BulkActionsBarProps) {
  const [showAdvisorSelect, setShowAdvisorSelect] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleBulkAssign = async (advisorId: string) => {
    setLoading(true)
    await bulkAssignLeads(selectedIds, advisorId)
    setLoading(false)
    setShowAdvisorSelect(false)
    onClear()
  }

  const handleExport = async () => {
    setExporting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('leads')
      .select('full_name, phone, email, city, stage, temperature, score, source, next_followup_at, created_at')
      .in('id', selectedIds)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      const headers = ['Name', 'Phone', 'Email', 'City', 'Stage', 'Temperature', 'Score', 'Source', 'Next Follow-up', 'Created']
      const rows = data.map((l) => [
        l.full_name,
        l.phone,
        l.email ?? '',
        l.city ?? '',
        l.stage,
        l.temperature,
        l.score,
        l.source,
        l.next_followup_at ? new Date(l.next_followup_at).toLocaleDateString('en-IN') : '',
        new Date(l.created_at).toLocaleDateString('en-IN'),
      ])
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-slate-900 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
        <span className="text-white text-sm font-medium">
          {selectedIds.length} lead{selectedIds.length !== 1 ? 's' : ''} selected
        </span>

        <div className="h-5 w-px bg-slate-700" />

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setShowAdvisorSelect((v) => !v)}
            loading={loading}
          >
            <UserCheck size={15} />
            Reassign
          </Button>

          {showAdvisorSelect && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[200px] overflow-hidden z-50">
              <p className="text-xs font-semibold text-slate-500 px-3 py-2 border-b border-slate-100">
                Assign to:
              </p>
              {advisors.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleBulkAssign(a.id)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {a.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={handleExport}
          loading={exporting}
        >
          <Download size={15} />
          Export CSV
        </Button>

        <div className="h-5 w-px bg-slate-700" />

        <button
          onClick={onClear}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
