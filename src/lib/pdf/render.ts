import { renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET = 'documents'

/** Render a react-pdf document element to a Buffer. */
export async function renderPdfBuffer(element: ReactElement): Promise<Buffer> {
  // renderToBuffer accepts a <Document> element.
  return renderToBuffer(element as any)
}

let bucketEnsured = false
async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  if (bucketEnsured) return
  // Idempotent: create the private bucket if it doesn't exist.
  await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
  bucketEnsured = true
}

/**
 * Upload a PDF buffer to the private `documents` bucket and return a long-lived
 * signed URL. `path` should be unique+stable, e.g. `receipts/<paymentId>.pdf`.
 */
export async function uploadPdf(path: string, buffer: Buffer): Promise<string> {
  const supabase = createServiceClient()
  await ensureBucket(supabase)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`PDF upload failed: ${error.message}`)

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 year
  if (signErr || !data) throw new Error(`Signed URL failed: ${signErr?.message ?? 'unknown'}`)
  return data.signedUrl
}
