'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'

function generateToken(): string {
  return randomBytes(9).toString('base64url') // 12-char URL-safe token
}

export async function createAlbum(
  formData: FormData,
): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const title = (formData.get('title') as string)?.trim()
  const projectId = (formData.get('project_id') as string) || null
  if (!title) return { success: false, error: 'Title is required' }
  if (!projectId) return { success: false, error: 'Select a project' }

  const token = generateToken()
  const { error } = await supabase.from('property_albums').insert({
    title,
    share_token: token,
    project_id: projectId,
    client_name: (formData.get('client_name') as string)?.trim() || null,
    message: (formData.get('message') as string)?.trim() || null,
    lead_id: (formData.get('lead_id') as string) || null,
    created_by: user.id,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/albums')
  return { success: true, token }
}

export async function toggleAlbum(id: string, is_active: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('property_albums').update({ is_active }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/albums')
  return { success: true }
}

export async function deleteAlbum(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('property_albums').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/albums')
  return { success: true }
}
