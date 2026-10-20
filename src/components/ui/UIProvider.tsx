'use client'

import { ToastProvider } from './Toast'
import { ConfirmProvider } from './ConfirmDialog'
import { PromptProvider } from './PromptDialog'

/** App-wide UI services: toasts and the confirm dialog. */
export default function UIProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PromptProvider>{children}</PromptProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
