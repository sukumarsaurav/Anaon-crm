import BlogPostForm from '@/components/website/BlogPostForm'
import PageHeader from '@/components/ui/PageHeader'

export default function NewBlogPostPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="New Blog Post" backHref="/blog" />
      <BlogPostForm />
    </div>
  )
}
