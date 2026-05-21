'use client'

import { useState, useRef, useTransition } from 'react'
import { FileText } from 'lucide-react'
import { sendMessage } from '@/lib/whatsapp/actions'
import TemplateSelector from './TemplateSelector'
import type { WaTemplate } from '@/types/whatsapp'

interface Props {
  conversationId: string
  templates: WaTemplate[]
  isOptedOut?: boolean
}

export default function ReplyBox({ conversationId, templates, isOptedOut }: Props) {
  const [text, setText] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    if (!text.trim() || isPending) return
    const msg = text.trim()
    setText('')
    setError(null)
    startTransition(async () => {
      const result = await sendMessage(conversationId, msg)
      if (!result.success) setError(result.error ?? 'Failed to send')
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isOptedOut) {
    return (
      <div className="px-4 py-3 bg-red-50 border-t border-red-200 text-center text-sm text-red-600">
        This contact has opted out of WhatsApp messages
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {showTemplates && (
        <TemplateSelector
          templates={templates}
          conversationId={conversationId}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs">{error}</div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Use template"
        >
          <FileText size={16} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 max-h-32 overflow-y-auto"
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isPending}
          className="flex-shrink-0 p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
