'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from './Modal'
import Button from './Button'

export interface ConfirmOptions {
  title?: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` (default) styles the confirm button red. */
  tone?: 'danger' | 'primary'
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Mount once near the root. Use `useConfirm()` anywhere below it. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(typeof o === 'string' ? { message: o } : o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpts(null)
  }, [])

  const tone = opts?.tone ?? 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title ?? 'Are you sure?'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => settle(false)}>{opts?.cancelLabel ?? 'Cancel'}</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {opts?.confirmLabel ?? (tone === 'danger' ? 'Delete' : 'Confirm')}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-600">{opts?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
