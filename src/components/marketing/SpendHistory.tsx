'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { History, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getCampaignSpendLogs, deleteSpendLog } from '@/lib/marketing/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CampaignSpendLog } from '@/types/marketing'

interface Props {
  campaignId: string
  campaignName: string
}

/** The spend entries behind a campaign's total, with delete for a wrong entry. */
export default function SpendHistory({ campaignId, campaignName }: Props) {
  const router = useRouter()
  const askConfirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<CampaignSpendLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function load() {
    start(async () => {
      const result = await getCampaignSpendLogs(campaignId)
      if (!result.success) setError(result.error ?? 'Could not load spend')
      else { setError(null); setLogs(result.logs ?? []) }
    })
  }

  function openHistory() {
    setOpen(true)
    load()
  }

  async function remove(log: CampaignSpendLog) {
    const what = log.kind === 'opening' ? 'the opening balance' : `the spend for ${formatDate(log.log_date)}`
    if (!(await askConfirm({ title: 'Delete spend entry', message: `Delete ${what} (${formatCurrency(log.spend, { mode: 'exact' })})? The campaign total drops by this amount.`, confirmLabel: 'Delete' }))) return
    start(async () => {
      const result = await deleteSpendLog(log.id)
      if (!result.success) { setError(result.error ?? 'Could not delete'); return }
      setLogs((prev) => prev?.filter((l) => l.id !== log.id) ?? null)
      router.refresh()
    })
  }

  const total = (logs ?? []).reduce((s, l) => s + Number(l.spend), 0)

  return (
    <>
      <button onClick={openHistory} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium">
        <History size={13} /> Spend history
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Spend history · ${campaignName}`} size="md">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-3">{error}</p>}
        {logs === null ? (
          <p className="text-sm text-slate-500 py-6 text-center">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No spend logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th scope="col" className="text-left py-2 pr-3">Date</th>
                  <th scope="col" className="text-right py-2 px-3">Spend</th>
                  <th scope="col" className="text-right py-2 px-3">Impr.</th>
                  <th scope="col" className="text-right py-2 px-3">Clicks</th>
                  <th scope="col" className="text-right py-2 px-3">Reach</th>
                  <th scope="col" className="py-2 pl-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 text-slate-700">
                      {l.kind === 'opening' ? <span title={l.notes ?? undefined}>Opening balance</span> : formatDate(l.log_date)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-900">{formatCurrency(l.spend, { mode: 'exact' })}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{l.impressions || '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{l.clicks || '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{l.reach || '—'}</td>
                    <td className="py-2 pl-3 text-right">
                      <button onClick={() => remove(l)} disabled={pending} aria-label="Delete spend entry"
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-2 pr-3 text-xs font-semibold text-slate-500">Total</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatCurrency(total, { mode: 'exact' })}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
