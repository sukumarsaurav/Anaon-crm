'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { addIPToWhitelist, toggleIPWhitelistEntry, toggleIPWhitelistGlobal } from '@/lib/security/actions'

interface Entry {
  id: string
  ip_address: string
  label: string | null
  is_active: boolean
  created_at: string
}

interface Props {
  entries: Entry[]
  enabled: boolean
}

export default function IPWhitelistManager({ entries, enabled }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  function handleGlobalToggle(e: React.ChangeEvent<HTMLInputElement>) {
    startTransition(async () => {
      await toggleIPWhitelistGlobal(e.target.checked)
      router.refresh()
    })
  }

  function handleEntryToggle(id: string, isActive: boolean) {
    setToggling(id)
    startTransition(async () => {
      await toggleIPWhitelistEntry(id, isActive)
      setToggling(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Global toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-slate-700">IP Whitelist Enforcement</p>
          <p className="text-xs text-slate-500 mt-0.5">When enabled, only whitelisted IPs can access the CRM dashboard</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" defaultChecked={enabled} onChange={handleGlobalToggle} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
        </label>
      </div>

      {enabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          IP whitelist is active. Make sure your current IP is whitelisted before saving changes.
        </div>
      )}

      {/* Entry list */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No IP addresses whitelisted yet</p>
        )}
        {entries.map(e => (
          <div key={e.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <code className="text-sm font-mono text-slate-800">{String(e.ip_address)}</code>
              {e.label && <span className="ml-2 text-xs text-slate-500">{e.label}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {e.is_active ? 'Active' : 'Disabled'}
              </span>
              <button
                onClick={() => handleEntryToggle(e.id, !e.is_active)}
                disabled={toggling === e.id}
                className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                {e.is_active ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add IP */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
          <Plus size={14} /> Add IP Address
        </button>
      ) : (
        <form action={addIPToWhitelist} onSubmit={() => setShowAdd(false)} className="flex gap-2">
          <input
            name="ip_address"
            required
            placeholder="192.168.1.1"
            pattern="^(\d{1,3}\.){3}\d{1,3}$"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            name="label"
            placeholder="Office / Home"
            className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            Add
          </button>
          <button type="button" onClick={() => setShowAdd(false)}
            className="px-3 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
