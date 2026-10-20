'use server'

import { randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getProfile } from '@/lib/supabase/getProfile'
import { FILES_BUCKET, FILE_FOLDERS, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES, fileUrl, type FileFolder } from './storage'

const STAFF = ['admin', 'manager', 'sales_advisor', 'telecaller']

/**
 * A one-time signed upload slot. The browser sends the file straight to Storage with it, which avoids
 * the 1 MB server-action body limit (KYC scans and agreements are larger).
 */
export async function createUploadTarget(input: {
  folder: FileFolder
  scopeId?: string | null
  filename: string
  contentType: string
  size: number
}): Promise<{ success: true; path: string; token: string; url: string } | { success: false; error: string }> {
  const session = await getProfile()
  if (!session?.user || !STAFF.includes(session.profile?.role ?? '')) return { success: false, error: 'Not authorized to upload files' }
  if (!FILE_FOLDERS.includes(input.folder)) return { success: false, error: 'Unknown folder' }
  if (!ALLOWED_UPLOAD_TYPES.includes(input.contentType)) return { success: false, error: 'Upload a PDF, image, Word or Excel file' }
  if (!(input.size > 0) || input.size > MAX_UPLOAD_BYTES) return { success: false, error: 'Files must be under 25 MB' }

  const scope = input.scopeId && /^[0-9a-f-]{36}$/i.test(input.scopeId) ? input.scopeId : 'general'
  const safeName = input.filename.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file'
  const path = `${input.folder}/${scope}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`

  const { data, error } = await createServiceClient().storage.from(FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: error?.message ?? 'Could not prepare the upload' }
  return { success: true, path, token: data.token, url: fileUrl(path) }
}
