'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBlogPost, updateBlogPost } from '@/lib/website/actions'
import { BLOG_CATEGORIES } from '@/types/website'
import type { BlogPost } from '@/types/website'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'

interface Props {
  post?: BlogPost
}

const STATUS_OPTIONS = [
  { value: 'false', label: 'Draft' },
  { value: 'true', label: 'Published' },
]

export default function BlogPostForm({ post }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function slugify(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (post) formData.set('was_published', String(post.is_published))
    setLoading(true)
    setError(null)

    startTransition(async () => {
      const result = post
        ? await updateBlogPost(post.id, formData)
        : await createBlogPost(formData)
      setLoading(false)
      if (!result.success) {
        setError(result.error ?? 'Failed to save')
      } else {
        router.push('/blog')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Input
            name="title"
            label="Title"
            required
            defaultValue={post?.title}
            placeholder="e.g. Why Jaipur is India's best real estate investment in 2025"
            onChange={(e) => {
              const slugInput = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="slug"]')
              if (slugInput && !post) slugInput.value = slugify(e.target.value)
            }}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              URL Slug <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 hover:border-slate-400 transition-all duration-150">
              <span className="px-3 py-2 bg-slate-50 text-xs text-slate-400 border-r border-slate-200 shrink-0">/blog/</span>
              <input name="slug" required defaultValue={post?.slug}
                placeholder="why-jaipur-is-best-real-estate-2025"
                className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white text-slate-900" />
            </div>
          </div>

          <Textarea
            name="excerpt"
            label="Excerpt"
            rows={2}
            defaultValue={post?.excerpt ?? ''}
            placeholder="2–3 sentence summary shown on listing page and in search results"
          />

          <Textarea
            name="content"
            label="Content"
            required
            rows={20}
            defaultValue={post?.content}
            placeholder="Write your article here. Supports plain text. Markdown support can be added later."
            className="font-mono"
          />

          {/* SEO */}
          <div className="border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">SEO Settings</h3>
            <Input
              name="meta_title"
              label="Meta Title"
              defaultValue={post?.meta_title ?? ''}
              placeholder="Override page title for search engines (max 60 chars)"
            />
            <Textarea
              name="meta_description"
              label="Meta Description"
              rows={2}
              defaultValue={post?.meta_description ?? ''}
              placeholder="160-char description for search result snippet"
            />
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <Select
              name="is_published"
              label="Status"
              defaultValue={post?.is_published ? 'true' : 'false'}
              options={STATUS_OPTIONS}
            />
            <Select
              name="category"
              label="Category"
              defaultValue={post?.category ?? 'general'}
              options={BLOG_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
            />
            <Input
              name="tags"
              label="Tags"
              defaultValue={post?.tags?.join(', ') ?? ''}
              placeholder="jaipur, plots, investment (comma-separated)"
            />
            <Input
              name="featured_image_url"
              label="Featured Image URL"
              type="url"
              defaultValue={post?.featured_image_url ?? ''}
              placeholder="https://..."
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => router.push('/blog')}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : post ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
