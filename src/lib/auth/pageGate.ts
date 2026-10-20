import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'

/**
 * Server-side gate for manager-only menus. The sidebar hid these links, but the pages themselves
 * opened for anyone who typed the URL (the data was still RLS-scoped, but the screens and their
 * buttons were not). Use from a segment's layout.tsx.
 */
export async function requireManagerPage() {
  const role = (await getProfile())?.profile?.role
  if (role !== 'admin' && role !== 'manager') redirect('/dashboard')
}
