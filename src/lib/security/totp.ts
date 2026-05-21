import * as OTPAuth from 'otpauth'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceSupabase = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export function generateTOTPSecret(accountName: string) {
  const secret = new OTPAuth.Secret({ size: 20 })
  const totp = new OTPAuth.TOTP({
    issuer: 'ANON INDIA CRM',
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return {
    secret: secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTOTPCode(secret: string, code: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: 'ANON INDIA CRM',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    return delta !== null
  } catch {
    return false
  }
}

export async function getTOTPSecretForUser(userId: string): Promise<string | null> {
  const { data } = await serviceSupabase()
    .from('profiles')
    .select('two_factor_secret, two_factor_enabled')
    .eq('id', userId)
    .single()
  if (!data?.two_factor_enabled || !data.two_factor_secret) return null
  return data.two_factor_secret
}

export async function enableTOTP(userId: string, secret: string) {
  await serviceSupabase()
    .from('profiles')
    .update({ two_factor_enabled: true, two_factor_secret: secret })
    .eq('id', userId)
}

export async function disableTOTP(userId: string) {
  await serviceSupabase()
    .from('profiles')
    .update({ two_factor_enabled: false, two_factor_secret: null })
    .eq('id', userId)
}
