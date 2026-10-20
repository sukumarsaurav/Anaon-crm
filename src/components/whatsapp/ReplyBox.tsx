'use client'

import { useState, useRef, useTransition } from 'react'
import { FileText, Paperclip, Loader2 } from 'lucide-react'
import { sendMessage } from '@/lib/whatsapp/actions'
import { sendInboxMedia } from '@/lib/whatsapp/media-actions'
import { createUploadTarget } from '@/lib/files/actions'
import { createClient } from '@/lib/supabase/client'
import { FILES_BUCKET, MAX_UPLOAD_BYTES } from '@/lib/files/storage'
import TemplateSelector from './TemplateSelector'
import type { WaTemplate } from '@/types/whatsapp'

interface Props {
  conversationId: string
  templates: WaTemplate[]
  isOptedOut?: boolean
  /** Shows the message in the thread right away; returns an id for onFailed. */
  onOptimistic?: (text: string) => string
  onFailed?: (tempId: string) => void
}

export default function ReplyBox({ conversationId, templates, isOptedOut, onOptimistic, onFailed }: Props) {
  const [text, setText] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [sendingFile, setSendingFile] = useState(false)

  // Brochures, layouts, price sheets: what's typed in the box goes as the caption.
  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) { setError('Files must be under 25 MB'); return }
    setSendingFile(true)
    try {
      const target = await createUploadTarget({ folder: 'whatsapp', scopeId: conversationId, filename: file.name, contentType: file.type, size: file.size })
      if (!target.success) { setError(target.error); return }
      const { error: upErr } = await createClient().storage.from(FILES_BUCKET).uploadToSignedUrl(target.path, target.token, file, { contentType: file.type })
      if (upErr) { setError(upErr.message); return }
      const res = await sendInboxMedia({ conversationId, path: target.path, filename: file.name, mimeType: file.type, caption: text.trim() || undefined })
      if (!res.success) { setError(res.error ?? 'Could not send the file'); return }
      setText('')
    } finally {
      setSendingFile(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSend() {
    if (!text.trim() || isPending) return
    const msg = text.trim()
    setText('')
    setError(null)
    const tempId = onOptimistic?.(msg)
    startTransition(async () => {
      const result = await sendMessage(conversationId, msg)
      if (!result.success) {
        if (tempId) onFailed?.(tempId)
        setError(result.error ?? 'Failed to send')
        setText(msg) // don't lose what they typed
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white">
      {isOptedOut && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          Opted out of WhatsApp marketing (replied STOP). You can still reply to their messages and send utility templates.
        </div>
      )}
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
          className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Use template"
        >
          <FileText size={16} />
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={sendingFile}
          className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          title="Send a file or photo"
          aria-label="Send a file or photo"
        >
          {sendingFile ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
        <input ref={fileRef} type="file" className="hidden" aria-hidden="true" tabIndex={-1}
          accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => handleFile(e.target.files?.[0])} />
        <textarea aria-label="Type a message... (Enter to send, Shift+Enter for new line)"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 max-h-32 overflow-y-auto"
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
