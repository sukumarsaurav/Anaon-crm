/**
 * Password rules for passwords people choose themselves (change-password). Plain module, shared by
 * the page (instant feedback) and the route (the rule that counts).
 */
export const MIN_PASSWORD_LENGTH = 10

export function passwordProblem(password: string, opts: { email?: string | null } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`
  if (password.length > 72) return 'Use at most 72 characters'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers'
  const local = opts.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) return 'Don’t use your email in your password'
  // The temporary passwords the CRM hands out look like Anon-xxxxxxxx@2026.
  if (/^anon-[0-9a-f]{8}@\d{4}$/i.test(password)) return 'Choose a new password, not the temporary one'
  return null
}

/** The flag new and reset accounts carry until they choose their own password (in app_metadata → JWT). */
export const MUST_CHANGE_PASSWORD = 'must_change_password'
