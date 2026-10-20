'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import Textarea from './Textarea'

type PromptFn = (label: string, opts?: { title?: string; confirmLabel?: string; optional?: boolean }) => Promise<string | null>

const PromptContext = createContext<PromptFn | null>(null)

/** Replaces `window.prompt`: resolves to the trimmed text, or null if cancelled (or empty, unless `optional`). */
export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ label: string; title?: string; confirmLabel?: string; optional?: boolean } | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((v: string | null) => void) | null>(null)

  const prompt = useCallback<PromptFn>((label, opts) => {
    setValue('')
    setState({ label, ...opts })
    return new Promise<string | null>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = (v: string | null) => {
    resolver.current?.(v)
    resolver.current = null
    setState(null)
  }
  const submit = () => settle(state?.optional ? value.trim() : value.trim() || null)

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => settle(null)}
        title={state?.title ?? 'Details required'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => settle(null)}>Cancel</Button>
            <Button onClick={submit} disabled={!state?.optional && !value.trim()}>{state?.confirmLabel ?? 'Continue'}</Button>
          </>
        }
      >
        <Textarea
          label={state?.label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          required={!state?.optional}
        />
      </Modal>
    </PromptContext.Provider>
  )
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext)
  if (!ctx) throw new Error('usePrompt must be used within PromptProvider')
  return ctx
}
