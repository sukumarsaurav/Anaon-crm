'use client'

import { useEffect, useState } from 'react'
import { X, UserCheck, Download, GitBranch, MessageSquare } from 'lucide-react'
import Button from '@/components/ui/Button'
import { bulkAssignLeads, bulkChangeStage, bulkSendWhatsApp } from '@/lib/leads/actions'
import { STAGE_CONFIG, STAGE_ORDER } from '@/types/leads'
import { createClient } from '@/lib/supabase/client'

interface BulkActionsBarProps {
  selectedIds: string[]
  advisors: { id: string; full_name: string }[]
  onClear: () => void
}

export default function BulkActionsBar({ selectedIds, advisors, onClear }: BulkActionsBarProps) {
  const [showAdvisorSelect, setShowAdvisorSelect] = useState(false)
  const [showStageSelect, setShowStageSelect] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [waText, setWaText] = useState('')
  const [waResult, setWaResult] = useState<string | null>(null)
  const [waTemplateId, setWaTemplateId] = useState('')
  const [waTemplates, setWaTemplates] = useState<{ id: string; display_name: string }[]>([])

  // Approved templates, loaded when the panel opens: a template is the only message
  // WhatsApp delivers to a lead who hasn't written in the last 24 hours.
  useEffect(() => {
    if (!showWhatsApp) return
    createClient()
      .from('whatsapp_templates')
      .select('id, display_name')
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('display_name')
      .then(({ data }) => setWaTemplates(data ?? []))
  }, [showWhatsApp])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleBulkAssign = async (advisorId: string) => {
    setLoading(true)
    await bulkAssignLeads(selectedIds, advisorId)
    setLoading(false)
    setShowAdvisorSelect(false)
    onClear()
  }

  const handleBulkStage = async (stage: string) => {
    setLoading(true)
    await bulkChangeStage(selectedIds, stage)
    setLoading(false)
    setShowStageSelect(false)
    onClear()
  }

  const handleBulkWhatsApp = async () => {
    if (!waTemplateId && !waText.trim()) return
    setLoading(true)
    const res = await bulkSendWhatsApp(selectedIds, waText, waTemplateId || null)
    setLoading(false)
    if (res.success) {
      setWaResult(`Sent ${res.sent ?? 0}${res.failed ? `, ${res.failed} failed${res.errors?.[0] ? ` — ${res.errors[0]}` : ''}` : ''}`)
      setWaText('')
      if (!res.failed) setTimeout(() => { setShowWhatsApp(false); setWaResult(null); onClear() }, 1500)
    } else {
      setWaResult(res.error ?? 'Failed')
    }
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
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  {a.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setShowStageSelect((v) => !v)}
            loading={loading}
          >
            <GitBranch size={15} />
            Stage
          </Button>

          {showStageSelect && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[200px] overflow-hidden z-50 max-h-72 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-500 px-3 py-2 border-b border-slate-100">Move to stage:</p>
              {STAGE_ORDER.map((stage) => (
                <button
                  key={stage}
                  onClick={() => handleBulkStage(stage)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                >
                  {STAGE_CONFIG[stage]?.label ?? stage}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setShowWhatsApp((v) => !v)}
          >
            <MessageSquare size={15} />
            WhatsApp
          </Button>

          {showWhatsApp && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-200 w-72 p-3 z-50">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                Message {selectedIds.length} lead{selectedIds.length !== 1 ? 's' : ''} · use <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code>
              </p>
              <select
                value={waTemplateId}
                onChange={(e) => setWaTemplateId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">Free text (only reaches leads who messaged in 24h)</option>
                {waTemplates.map((t) => (
                  <option key={t.id} value={t.id}>Template: {t.display_name}</option>
                ))}
              </select>
              {!waTemplateId && (
                <textarea
                  value={waText}
                  onChange={(e) => setWaText(e.target.value)}
                  rows={3}
                  placeholder="Hi {{name}}, ..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500">{waResult}</span>
                <Button variant="primary" size="xs" onClick={handleBulkWhatsApp} loading={loading} disabled={!waTemplateId && !waText.trim()}>
                  Send
                </Button>
              </div>
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
