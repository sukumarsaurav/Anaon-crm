'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

async function requireAdmin() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return null
  const profile = (await getProfile())?.profile
  if (!['admin', 'manager'].includes(profile?.role ?? '')) return null
  return { supabase, user }
}

// ── Blog ──────────────────────────────────────────────────────────

export async function createBlogPost(formData: FormData) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase, user } = auth

  const title = formData.get('title') as string
  const slug  = (formData.get('slug') as string) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { error } = await supabase.from('blog_posts').insert({
    title,
    slug,
    excerpt:           formData.get('excerpt') as string || null,
    content:           formData.get('content') as string || '',
    featured_image_url: formData.get('featured_image_url') as string || null,
    category:          formData.get('category') as string || 'general',
    tags:              (formData.get('tags') as string || '').split(',').map((t) => t.trim()).filter(Boolean),
    meta_title:        formData.get('meta_title') as string || null,
    meta_description:  formData.get('meta_description') as string || null,
    is_published:      formData.get('is_published') === 'true',
    published_at:      formData.get('is_published') === 'true' ? new Date().toISOString() : null,
    author_id:         user.id,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/blog')
  return { success: true }
}

export async function updateBlogPost(id: string, formData: FormData) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const wasPublished = formData.get('was_published') === 'true'
  const isPublished  = formData.get('is_published') === 'true'

  const { error } = await supabase.from('blog_posts').update({
    title:             formData.get('title') as string,
    slug:              formData.get('slug') as string,
    excerpt:           formData.get('excerpt') as string || null,
    content:           formData.get('content') as string || '',
    featured_image_url: formData.get('featured_image_url') as string || null,
    category:          formData.get('category') as string,
    tags:              (formData.get('tags') as string || '').split(',').map((t) => t.trim()).filter(Boolean),
    meta_title:        formData.get('meta_title') as string || null,
    meta_description:  formData.get('meta_description') as string || null,
    is_published:      isPublished,
    published_at:      isPublished && !wasPublished ? new Date().toISOString() : undefined,
    updated_at:        new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/blog')
  return { success: true }
}

export async function deleteBlogPost(id: string) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/blog')
  return { success: true }
}

// ── Careers ───────────────────────────────────────────────────────

export async function createCareerListing(formData: FormData) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('career_listings').insert({
    title:           formData.get('title') as string,
    department:      formData.get('department') as string,
    employment_type: formData.get('employment_type') as string,
    location:        formData.get('location') as string || 'Jaipur',
    description:     formData.get('description') as string,
    requirements:    formData.get('requirements') as string || null,
    is_active:       formData.get('is_active') !== 'false',
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/website/careers')
  return { success: true }
}

export async function updateCareerListing(id: string, formData: FormData) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('career_listings').update({
    title:           formData.get('title') as string,
    department:      formData.get('department') as string,
    employment_type: formData.get('employment_type') as string,
    location:        formData.get('location') as string,
    description:     formData.get('description') as string,
    requirements:    formData.get('requirements') as string || null,
    is_active:       formData.get('is_active') !== 'false',
    updated_at:      new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/website/careers')
  return { success: true }
}

export async function toggleCareerActive(id: string, active: boolean) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('career_listings').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/website/careers')
  return { success: true }
}

// ── Testimonials ──────────────────────────────────────────────────

export async function createTestimonial(formData: FormData) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('testimonials').insert({
    client_name: formData.get('client_name') as string,
    project:     formData.get('project') as string || null,
    content:     formData.get('content') as string,
    rating:      parseInt(formData.get('rating') as string, 10) || 5,
    photo_url:   formData.get('photo_url') as string || null,
    is_active:   true,
    sort_order:  parseInt(formData.get('sort_order') as string, 10) || 0,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/website')
  return { success: true }
}

export async function toggleTestimonialActive(id: string, active: boolean) {
  const auth = await requireAdmin()
  if (!auth) return { success: false, error: 'Unauthorized' }
  const { supabase } = auth

  const { error } = await supabase.from('testimonials').update({ is_active: active }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/website')
  return { success: true }
}
