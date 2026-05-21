'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleConstructionUpdatePublished, deleteConstructionUpdate } from '@/lib/portal/actions'
import { Eye, EyeOff, Trash2 } from 'lucide-react'

interface Props {
  updateId: string
  projectId: string
  isPublished: boolean
}

export default function ConstructionUpdateActions({ updateId, projectId, isPublished }: Props) {
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      await toggleConstructionUpdatePublished(updateId, !isPublished)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('Delete this update?')) return
    startTransition(async () => {
      await deleteConstructionUpdate(updateId, projectId)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleToggle} title={isPublished ? 'Unpublish' : 'Publish'}
        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100">
        {isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button onClick={handleDelete} title="Delete"
        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
