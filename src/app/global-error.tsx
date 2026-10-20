'use client'

import ErrorView from './ErrorView'

// Replaces the root layout when it itself throws, so it must render its own <html>/<body>.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <ErrorView {...props} fullscreen />
      </body>
    </html>
  )
}
