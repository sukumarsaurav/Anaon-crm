'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { installTemplate } from '@/lib/automation/actions'
import { Download, Check } from 'lucide-react'

interface Props { templateKey: string }

export default function InstallTemplateButton({ templateKey }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleInstall() {
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await installTemplate(templateKey)
      setLoading(false)
      if (result.success) { setDone(true); router.refresh() }
      else setError(result.error ?? 'Failed')
    })
  }

  if (done) return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 bg-green-50 rounded-lg">
      <Check size={12} /> Installed
    </span>
  )

  return (
    <div>
      <button onClick={handleInstall} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        <Download size={12} />
        {loading ? 'Installing...' : 'Install'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
