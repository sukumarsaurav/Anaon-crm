import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

/**
 * Tab title for a detail page: the record's own name ("Rahul Sharma · ANON CRM") instead of the same
 * generic title on every lead. One single-column read through the user's session, so RLS decides
 * what is visible; any miss falls back to the generic title.
 */
export async function recordTitle(
  table: string,
  columns: string[],
  params: Promise<{ [key: string]: string }>,
  fallback: string,
  key = 'id',
): Promise<Metadata> {
  try {
    const id = (await params)[key]
    const supabase = await createClient()
    const { data } = await supabase.from(table).select(columns.join(', ')).eq('id', id).maybeSingle()
    const row = (data ?? {}) as unknown as Record<string, unknown>
    const name = columns.map((c) => row[c]).find((v) => typeof v === 'string' && v.trim())
    return { title: (name as string | undefined) ?? fallback }
  } catch {
    return { title: fallback }
  }
}
