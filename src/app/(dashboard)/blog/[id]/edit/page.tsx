export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getBlogPostById } from '@/lib/website/queries'
import BlogPostForm from '@/components/website/BlogPostForm'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: PageProps) {
  const { id } = await params
  const post = await getBlogPostById(id)
  if (!post) notFound()

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Edit Post" subtitle={post.title} backHref="/blog" />
      <BlogPostForm post={post} />
    </div>
  )
}
