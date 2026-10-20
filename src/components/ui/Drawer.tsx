'use client'

import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDialogBehavior } from './useDialogBehavior'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Text label for assistive tech when `title` is not plain text. */
  ariaLabel?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }

/** Right-hand side panel with the same focus trap, Escape and scroll lock as Modal. */
export default function Drawer({ open, onClose, title, ariaLabel, children, footer, size = 'sm', className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialogBehavior(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        className={cn('w-full bg-white shadow-2xl flex flex-col overflow-hidden', SIZES[size], className)}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div id={titleId} className="flex items-center gap-2 min-w-0 font-bold text-slate-900 text-lg">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-slate-400 hover:text-slate-600 focus-ring"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t border-slate-200">{footer}</div>}
      </div>
    </div>
  )
}
