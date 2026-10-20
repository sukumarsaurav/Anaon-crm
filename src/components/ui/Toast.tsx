'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: number; tone: ToastTone; message: string }

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TONE: Record<ToastTone, { box: string; icon: React.ReactNode }> = {
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> },
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: <AlertCircle size={18} className="text-red-600 shrink-0" /> },
  info: { box: 'border-blue-200 bg-blue-50 text-blue-900', icon: <Info size={18} className="text-blue-600 shrink-0" /> },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++
    setItems((l) => [...l.slice(-3), { id, tone, message }])
    // Errors linger a little longer so they can be read.
    setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000)
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm', TONE[t.tone].box)}
          >
            {TONE[t.tone].icon}
            <p className="flex-1 min-w-0 break-words">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded text-current opacity-60 hover:opacity-100 focus-ring"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
