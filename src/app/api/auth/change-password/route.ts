import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/security/audit'
import { passwordProblem, MUST_CHANGE_PASSWORD } from '@/lib/security/passwordPolicy'

/**
 * Sets the signed-in user's own password and clears the "must change password" flag that new and
 * reset accounts carry. The flag lives in app_metadata (users can't edit it), so it is cleared with
 * the service role, and the session is refreshed so the new token no longer carries it.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // getUser() (not claims): authoritative, and this is a credential change.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Your session has ended. Sign in again.' }, { status: 401 })

  let password = ''
  try { password = String((await req.json())?.password ?? '') } catch { /* empty body */ }
  const problem = passwordProblem(password, { email: user.email })
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    const same = /different from the old password|same password/i.test(error.message)
    return NextResponse.json({ error: same ? 'Choose a password you haven’t used for this account' : error.message }, { status: 400 })
  }

  const wasForced = user.app_metadata?.[MUST_CHANGE_PASSWORD] === true
  if (wasForced) {
    // null removes the key (app_metadata is merged, not replaced).
    const { error: flagErr } = await createServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { [MUST_CHANGE_PASSWORD]: null } })
    if (flagErr) return NextResponse.json({ error: 'Password saved, but the account could not be unlocked. Contact an administrator.' }, { status: 500 })
    await supabase.auth.refreshSession()
  }

  await writeAuditLog({ userId: user.id, action: 'password_changed', tableName: 'profiles', recordId: user.id, metadata: { forced: wasForced } })

  const role = user.app_metadata?.role as string | undefined
  return NextResponse.json({ success: true, redirectTo: role === 'broker' ? '/broker-portal' : '/dashboard' })
}
