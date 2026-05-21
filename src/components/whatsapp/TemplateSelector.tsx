'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { sendTemplateToConversation } from '@/lib/whatsapp/actions'
import { renderTemplate } from '@/lib/whatsapp/provider'
import type { WaTemplate } from '@/types/whatsapp'

interface Props {
  templates: WaTemplate[]
  conversationId: string
  onClose: () => void
}

export default function TemplateSelector({ templates, conversationId, onClose }: Props) {
  const [selected, setSelected] = useState<WaTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSelect(template: WaTemplate) {
    setSelected(template)
    setValues({})
    setError(null)
  }

  function handleSend() {
    if (!selected || isPending) return
    startTransition(async () => {
      const result = await sendTemplateToConversation(conversationId, selected.id, values)
      if (result.success) {
        onClose()
      } else {
        setError(result.error ?? 'Failed to send')
      }
    })
  }

  const preview = selected
    ? renderTemplate(selected.body, selected.variable_names, values)
    : null

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Select Template</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      {!selected ? (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No approved templates</p>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
            >
              <div className="font-medium text-gray-800">{t.display_name}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{t.body}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-blue-600 hover:underline"
          >
            ← Back to templates
          </button>

          <div className="font-medium text-sm text-gray-800">{selected.display_name}</div>

          {selected.variable_names.length > 0 && (
            <div className="space-y-2">
              {selected.variable_names.map((name) => (
                <div key={name}>
                  <label className="text-xs text-gray-600 mb-1 block">{`{{${name}}}`}</label>
                  <input
                    type="text"
                    value={values[name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                    placeholder={`Enter ${name}`}
                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
              {preview}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSend}
            disabled={isPending}
            className="w-full py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-40"
          >
            {isPending ? 'Sending...' : 'Send Template'}
          </button>
        </div>
      )}
    </div>
  )
}
