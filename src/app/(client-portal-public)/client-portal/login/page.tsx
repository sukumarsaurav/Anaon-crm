import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import OtpLoginForm from '@/components/client-portal/OtpLoginForm'

export default async function ClientPortalLoginPage() {
  // If already has a valid session, redirect to portal
  const cookieStore = await cookies()
  const token = cookieStore.get('client_portal_session')?.value

  if (token) {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: session } = await service
      .from('portal_sessions')
      .select('expires_at')
      .eq('token', token)
      .single()

    if (session && new Date(session.expires_at) > new Date()) {
      redirect('/client-portal')
    }
  }

  return <OtpLoginForm />
}
