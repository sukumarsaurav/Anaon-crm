'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBlogPost } from '@/lib/website/actions'
import { Trash2 } from 'lucide-react'

interface Props { postId: string }

export default function BlogPostActions({ postId }: Props) {
  const router = useRouter()

  function handleDelete() {
    if (!confirm('Delete this blog post? This cannot be undone.')) return
    startTransition(async () => {
      await deleteBlogPost(postId)
      router.refresh()
    })
  }

  return (
    <button onClick={handleDelete} title="Delete"
      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100">
      <Trash2 size={14} />
    </button>
  )
}
