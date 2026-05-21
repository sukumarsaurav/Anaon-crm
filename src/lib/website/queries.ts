'use server'

import { createClient } from '@/lib/supabase/server'
import type { BlogPost, CareerListing, CareerApplication, Testimonial } from '@/types/website'

// ── Blog ──────────────────────────────────────────────────────────

export async function getBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('*, author:profiles!blog_posts_author_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as BlogPost[]
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('*, author:profiles!blog_posts_author_id_fkey(id, full_name)')
    .eq('id', id)
    .single()
  return data as unknown as BlogPost | null
}

// ── Careers ───────────────────────────────────────────────────────

export async function getCareerListings(): Promise<CareerListing[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('career_listings')
    .select('*')
    .order('created_at', { ascending: false })
  return (data ?? []) as CareerListing[]
}

export async function getCareerApplications(): Promise<CareerApplication[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('career_applications')
    .select('*, listing:career_listings!career_applications_listing_id_fkey(title, department)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as CareerApplication[]
}

// ── Testimonials ──────────────────────────────────────────────────

export async function getTestimonials(): Promise<Testimonial[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order')
  return (data ?? []) as Testimonial[]
}
