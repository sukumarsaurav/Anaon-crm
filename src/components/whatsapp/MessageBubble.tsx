import { FileText, Bot, Circle, Check, CheckCheck, AlertCircle } from 'lucide-react'
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
            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'
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

        {/* Body */}
        <p className="whitespace-pre-wrap break-words">{message.body ?? '[Media message]'}</p>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
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
