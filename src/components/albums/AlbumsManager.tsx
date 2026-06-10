'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus, Copy, Check, ExternalLink, Eye, Trash2, Power } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { createAlbum, toggleAlbum, deleteAlbum } from '@/lib/albums/actions'
import type { AlbumListItem } from '@/lib/albums/queries'
import { cn } from '@/lib/utils'

interface Props {
  albums: AlbumListItem[]
  projects: { id: string; name: string }[]
  appUrl?: string
}

export default function AlbumsManager({ albums, projects, appUrl }: Props) {
  const [origin, setOrigin] = useState(appUrl ?? '')
  const [showCreate, setShowCreate] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!appUrl) setOrigin(window.location.origin)
  }, [appUrl])

  const shareUrl = (token: string) => `${origin || ''}/share/${token}`

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(shareUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 1500)
  }

  const submit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = await createAlbum(formData)
      if (res.success && res.token) setCreatedToken(res.token)
      else setError(res.error ?? 'Failed to create')
    })
  }

  const closeCreate = () => {
    setShowCreate(false)
    setCreatedToken(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Album
        </Button>
      </div>

      {albums.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">No albums yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create a branded, shareable property album to send clients over WhatsApp — and see when they open it.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {albums.map((a) => (
            <div
              key={a.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-white p-3.5',
                a.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{a.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  {a.project?.name ?? 'No project'}
                  {a.client_name ? ` · for ${a.client_name}` : ''}
                  {a.creator?.full_name ? ` · by ${a.creator.full_name}` : ''}
                </p>
              </div>
              <span className="shrink-0 flex items-center gap-1 text-sm text-slate-600" title="Views">
                <Eye size={14} className="text-slate-400" />
                {a.view_count}
              </span>
              <button
                onClick={() => copy(a.share_token)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                title="Copy share link"
              >
                {copied === a.share_token ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
              <a
                href={shareUrl(a.share_token)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                title="Open"
              >
                <ExternalLink size={15} />
              </a>
              <button
                onClick={() => startTransition(() => { void toggleAlbum(a.id, !a.is_active) })}
                disabled={isPending}
                className="shrink-0 p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                title={a.is_active ? 'Disable link' : 'Enable link'}
              >
                <Power size={15} />
              </button>
              <button
                onClick={() => { if (confirm('Delete this album?')) startTransition(() => { void deleteAlbum(a.id) }) }}
                disabled={isPending}
                className="shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={closeCreate} title="New Property Album" size="md">
        {createdToken ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
              Album created. Share this link with your client:
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 text-xs text-slate-600">
                {shareUrl(createdToken)}
              </code>
              <button
                onClick={() => copy(createdToken)}
                className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600"
              >
                {copied === createdToken ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={closeCreate}>Done</Button>
            </div>
          </div>
        ) : (
          <form action={submit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            <Input label="Album title" name="title" required placeholder="e.g. Premium 2BHK Options — Jaipur" />
            <Select
              label="Project"
              name="project_id"
              required
              placeholder="Select a project"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Input label="Client name (optional)" name="client_name" placeholder="Personalizes the page" />
            <div>
              <label className="text-sm font-medium text-slate-700">Intro message (optional)</label>
              <textarea
                name="message"
                rows={2}
                placeholder="A short note shown at the top of the album…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-400">
              Available units for the project are shown automatically. You can refine the selection later.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeCreate} disabled={isPending}>Cancel</Button>
              <Button type="submit" loading={isPending}>Create Album</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
