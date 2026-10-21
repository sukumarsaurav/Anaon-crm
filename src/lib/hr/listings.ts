'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

/** Job openings shown on the website's careers page (via /api/public/careers). Admins and managers. */

const TYPES = ['full_time', 'part_time', 'contract', 'internship']

async function manager() {
  const role = (await getProfile())?.profile?.role
  return role === 'admin' || role === 'manager'
}

export async function saveListing(formData: FormData, id?: string): Promise<{ success: boolean; error?: string }> {
  if (!(await manager())) return { success: false, error: 'Only admins and managers can manage openings' }
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  if (!title || !description) return { success: false, error: 'Title and description are required' }
  const employmentType = (formData.get('employment_type') as string) || 'full_time'
  if (!TYPES.includes(employmentType)) return { success: false, error: 'Choose an employment type' }

  const row = {
    title,
    department: (formData.get('department') as string)?.trim() || 'Sales',
    employment_type: employmentType,
    location: (formData.get('location') as string)?.trim() || 'Jaipur',
    description,
    requirements: (formData.get('requirements') as string)?.trim() || null,
    is_active: formData.get('is_active') !== 'false',
    updated_at: new Date().toISOString(),
  }
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('career_listings').update(row).eq('id', id)
    : await supabase.from('career_listings').insert(row)
  if (error) return { success: false, error: error.message }
  revalidatePath('/hr/recruitment/openings')
  return { success: true }
}

export async function setListingActive(id: string, active: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await manager())) return { success: false, error: 'Only admins and managers can manage openings' }
  const supabase = await createClient()
  const { error } = await supabase.from('career_listings').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/hr/recruitment/openings')
  return { success: true }
}
