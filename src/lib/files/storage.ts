/**
 * Staff uploads (client KYC documents, project documents, signed agreements, construction photos,
 * legal templates). Before this every one of those was a pasted URL, so files had to live somewhere
 * else first.
 *
 * Files go to a PRIVATE bucket. The stored URL is `/api/files/<path>`, which checks who is asking and
 * redirects to a short-lived signed URL, so a copied link is useless to anyone outside the CRM.
 */

export const FILES_BUCKET = 'crm-files'

/** Top-level folders, and who may read them through /api/files. */
export const FILE_FOLDERS = ['clients', 'projects', 'bookings', 'construction', 'legal', 'whatsapp', 'hr'] as const
export type FileFolder = (typeof FILE_FOLDERS)[number]

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export function fileUrl(path: string): string {
  return `/api/files/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** The bucket path behind an `/api/files/…` link, or null for any other URL. */
export function filePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf('/api/files/')
  if (i < 0) return null
  return url.slice(i + '/api/files/'.length).split('?')[0].split('/').map(decodeURIComponent).join('/')
}
