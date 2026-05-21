'use client'

import { useState, useTransition } from 'react'
import { updateKycChecklist, updateKycStatus } from '@/lib/clients/actions'
import { KYC_STATUS_CONFIG } from '@/types/clients'
import type { Client, KycStatus } from '@/types/clients'
import { CheckCircle2, Circle } from 'lucide-react'

interface Props {
  client: Client
  canManage: boolean
}

const CHECKLIST: Array<{ field: string; label: string; key: keyof Client }> = [
  { field: 'kyc_aadhar_submitted',        label: 'Aadhar Card',     key: 'kyc_aadhar_submitted' },
  { field: 'kyc_pan_submitted',           label: 'PAN Card',        key: 'kyc_pan_submitted' },
  { field: 'kyc_photo_submitted',         label: 'Photograph',      key: 'kyc_photo_submitted' },
  { field: 'kyc_address_proof_submitted', label: 'Address Proof',   key: 'kyc_address_proof_submitted' },
]

export default function KycChecklist({ client, canManage }: Props) {
  const [pending, startTransition] = useTransition()
  const [statusPending, startStatusTransition] = useTransition()
  const cfg = KYC_STATUS_CONFIG[client.kyc_status]

  function toggle(field: string, current: boolean) {
    if (!canManage) return
    startTransition(async () => {
      await updateKycChecklist(client.id, field, !current)
    })
  }

  function changeStatus(status: KycStatus) {
    startStatusTransition(async () => {
      await updateKycStatus(client.id, status)
    })
  }

  const submittedCount = CHECKLIST.filter((c) => client[c.key] as boolean).length

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">KYC Status</h3>
          <p className="text-xs text-slate-500 mt-0.5">{submittedCount}/4 documents submitted</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {CHECKLIST.map(({ field, label, key }) => {
          const checked = client[key] as boolean
          return (
            <button
              key={field}
              onClick={() => toggle(field, checked)}
              disabled={pending || !canManage}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-sm ${
                checked
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              } ${canManage ? 'hover:border-indigo-300 cursor-pointer' : 'cursor-default'}`}
            >
              {checked
                ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                : <Circle size={16} className="text-slate-300 shrink-0" />}
              {label}
            </button>
          )
        })}
      </div>

      {canManage && (
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          {(['pending', 'verified', 'rejected'] as KycStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={statusPending || client.kyc_status === s}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-40 ${
                client.kyc_status === s
                  ? `${KYC_STATUS_CONFIG[s].color} ${KYC_STATUS_CONFIG[s].bg} border-current`
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              {KYC_STATUS_CONFIG[s].label.replace('KYC ', '')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
