import { FileText, Bot, Circle, Check, CheckCheck, AlertCircle, Paperclip, MapPin } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { WaMessage } from '@/types/whatsapp'

interface Props {
  message: WaMessage
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'inline-block'
  if (status === 'failed') return <AlertCircle size={11} className={cls} />
  if (status === 'read' || status === 'delivered') return <CheckCheck size={11} className={cls} />
  if (status === 'sent') return <Check size={11} className={cls} />
  return <Circle size={9} className={cls} />
}

function Attachment({ message, isOutbound }: { message: WaMessage; isOutbound: boolean }) {
  const url = message.media_url
  if (!url) return null
  const mime = message.media_mime_type ?? ''
  const kind = message.type === 'sticker' || mime.startsWith('image/') ? 'image'
    : mime.startsWith('video/') ? 'video'
    : mime.startsWith('audio/') ? 'audio'
    : 'file'

  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL */}
        <img src={url} alt={message.media_filename ?? 'Image'} className="rounded-lg max-h-64 w-auto object-contain" />
      </a>
    )
  }
  if (kind === 'video') return <video src={url} controls className="rounded-lg max-h-64 mb-1" />
  if (kind === 'audio') return <audio src={url} controls className="mb-1 max-w-full" />
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg text-xs underline-offset-2 hover:underline ${
        isOutbound ? 'bg-white/20' : 'bg-slate-100'
      }`}
    >
      <Paperclip size={12} /> {message.media_filename ?? 'Attachment'}
    </a>
  )
}

export default function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === 'outbound'
  const isBot = message.is_bot_message

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
          isOutbound
            ? isBot
              ? 'bg-blue-100 text-blue-900'
              : 'bg-green-500 text-white rounded-br-sm'
            : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm shadow-sm'
        }`}
      >
        {/* Template label */}
        {message.type === 'template' && (
          <p className="text-xs opacity-60 mb-1 flex items-center gap-1"><FileText size={11} /> Template: {message.template_name}</p>
        )}

        {/* Bot label */}
        {isBot && (
          <p className="text-xs text-blue-500 mb-1 flex items-center gap-1"><Bot size={11} /> Bot</p>
        )}

        <Attachment message={message} isOutbound={isOutbound} />

        {/* Body — for media it's the caption, or "[image]" when there is none */}
        {(() => {
          const placeholder = /^\[[a-z_]+\]$/.test(message.body ?? '')
          if (message.media_url && placeholder) return null
          if (!message.body) return message.media_url ? null : <p className="italic opacity-70">[{message.type}]</p>
          return (
            <p className="whitespace-pre-wrap break-words">
              {message.type === 'location' && <MapPin size={12} className="inline mr-1" />}
              {message.body}
            </p>
          )
        })()}

        {/* Footer */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-white/60' : 'text-slate-400'}`}>
          <span className="text-xs">{formatDateTime(message.created_at)}</span>
          {isOutbound && (
            <span
              className={`${
                message.delivery_status === 'read'
                  ? 'text-blue-300'
                  : message.delivery_status === 'failed'
                  ? 'text-red-300'
                  : 'text-white/60'
              }`}
            >
              <StatusIcon status={message.delivery_status ?? 'queued'} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
