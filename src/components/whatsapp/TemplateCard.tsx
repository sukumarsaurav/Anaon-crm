'use client'

import { useTransition } from 'react'
import { toggleTemplateActive } from '@/lib/whatsapp/actions'
import type { WaTemplate } from '@/types/whatsapp'

interface Props {
  template: WaTemplate
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50' },
  pending_approval: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50' },
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50' },
  disabled: { label: 'Disabled', color: 'text-gray-500', bg: 'bg-gray-100' },
}

export default function TemplateCard({ template }: Props) {
  const [isPending, startTransition] = useTransition()
  const statusCfg = STATUS_CONFIG[template.status] ?? STATUS_CONFIG.draft

  function handleToggle() {
    startTransition(async () => { await toggleTemplateActive(template.id, !template.is_active) })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{template.display_name}</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{template.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.bg}`}>
            {statusCfg.label}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
            {template.category}
          </span>
        </div>
      </div>

      {/* Body preview */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{template.body}</p>
      </div>

      {/* Variables */}
      {template.variable_names.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.variable_names.map((v) => (
            <span key={v} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{template.language.toUpperCase()}</span>
        {template.status === 'approved' && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
              template.is_active
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {template.is_active ? 'Active' : 'Inactive'}
          </button>
        )}
      </div>
    </div>
  )
}
