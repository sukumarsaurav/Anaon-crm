export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getBlogPosts } from '@/lib/website/queries'
import { formatDate } from '@/lib/utils'
import { BLOG_CATEGORIES } from '@/types/website'
import { PenLine, Eye, EyeOff, Plus } from 'lucide-react'
import BlogPostActions from '@/components/website/BlogPostActions'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'

const BLOG_PUBLISH_CONFIG = {
  published: { label: 'Published', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  draft:     { label: 'Draft',     color: 'text-slate-500',   bg: 'bg-slate-100'  },
}

export default async function BlogManagementPage() {
  const posts = await getBlogPosts()

  const published = posts.filter((p) => p.is_published).length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Blog Posts"
        subtitle={`${published} published · ${posts.length} total`}
        actions={
          <Button href="/blog/new">
            <Plus size={16} /> New Post
          </Button>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          bordered
          icon={<PenLine size={40} />}
          title="No blog posts yet"
          action={
            <Link href="/blog/new" className="text-sm text-indigo-600 hover:text-indigo-700">
              Write your first post →
            </Link>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {posts.map((post) => {
              const catLabel = BLOG_CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category
              return (
                <div key={post.id} className="flex items-start justify-between gap-4 p-4 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {post.is_published
                        ? <Eye size={14} className="text-emerald-500 shrink-0" />
                        : <EyeOff size={14} className="text-slate-400 shrink-0" />
                      }
                      <Link href={`/blog/${post.id}/edit`}
                        className="font-semibold text-slate-900 hover:text-indigo-600 truncate text-sm">
                        {post.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{catLabel}</span>
                      <span>·</span>
                      <span>{formatDate(post.published_at ?? post.created_at)}</span>
                      {post.author && <><span>·</span><span>{post.author.full_name}</span></>}
                      {post.view_count > 0 && <><span>·</span><span>{post.view_count} views</span></>}
                    </div>
                    {post.excerpt && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{post.excerpt}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge
                      config={post.is_published ? BLOG_PUBLISH_CONFIG.published : BLOG_PUBLISH_CONFIG.draft}
                      size="sm"
                    />
                    <Link href={`/blog/${post.id}/edit`}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100">
                      <PenLine size={14} />
                    </Link>
                    <BlogPostActions postId={post.id} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
