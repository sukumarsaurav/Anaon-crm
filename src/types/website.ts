export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  featured_image_url: string | null
  category: string
  tags: string[]
  meta_title: string | null
  meta_description: string | null
  is_published: boolean
  published_at: string | null
  author_id: string | null
  view_count: number
  created_at: string
  updated_at: string
  author?: { id: string; full_name: string } | null
}

export interface CareerListing {
  id: string
  title: string
  department: string
  employment_type: string
  location: string
  description: string
  requirements: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CareerApplication {
  id: string
  listing_id: string | null
  name: string
  phone: string
  email: string | null
  resume_url: string | null
  cover_letter: string | null
  status: string
  created_at: string
  listing?: { title: string; department: string } | null
}

export interface Testimonial {
  id: string
  client_name: string
  project: string | null
  content: string
  rating: number
  photo_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export const BLOG_CATEGORIES = [
  { value: 'investment', label: 'Investment Tips' },
  { value: 'market',     label: 'Market Trends' },
  { value: 'project',    label: 'Project Updates' },
  { value: 'legal',      label: 'Legal & RERA' },
  { value: 'lifestyle',  label: 'Lifestyle' },
  { value: 'general',    label: 'General' },
]

export const EMPLOYMENT_TYPES = [
  { value: 'full_time',  label: 'Full Time' },
  { value: 'part_time',  label: 'Part Time' },
  { value: 'contract',   label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]
