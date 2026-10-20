/**
 * Template text helpers shared by server and client code (no env, no Node APIs).
 *
 * CRM-written bodies name their variables ({{name}}); bodies synced from AgencyX/Meta are
 * positional ({{1}}). variable_names is in {{1}}, {{2}}… order for both.
 */
export function renderTemplate(
  body: string,
  variableNames: string[],
  values: Record<string, string>
): string {
  // One pass: replacing variable by variable re-scanned text already substituted, so a value
  // that happened to contain "{{2}}" was expanded again.
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, key: string) => {
    const byPosition = /^\d+$/.test(key) ? variableNames[Number(key) - 1] : undefined
    const name = byPosition ?? (variableNames.includes(key) ? key : undefined)
    if (name === undefined) return whole
    return values[name] || `[${name}]`
  })
}

/** Named variables in first-appearance order — the order Meta numbers them in. */
export function namedVariables(body: string): string[] {
  const matches = body.match(/\{\{\s*([^}]+?)\s*\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, '')))]
}

/** {{name}} → {{1}}, as Meta requires for submission. */
export function toPositionalBody(body: string, variableNames: string[]): string {
  let out = body
  variableNames.forEach((name, i) => {
    out = out.replace(new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), `{{${i + 1}}}`)
  })
  return out
}

/** A believable sample per variable — Meta's reviewers reject "test"/"xxx" examples. */
export function sampleValueFor(name: string): string {
  const k = name.toLowerCase()
  if (/project|property|site/.test(k)) return 'ANON Greens'
  if (/advisor|agent|executive|manager/.test(k)) return /phone|mobile/.test(k) ? '9876543210' : 'Priya Sharma'
  if (/phone|mobile|contact/.test(k)) return '9876543210'
  if (/amount|price/.test(k)) return '50,000'
  if (/date|day/.test(k)) return '25 Oct 2026'
  if (/time|slot/.test(k)) return '11:00 AM'
  if (/booking/.test(k)) return 'ANON-2026-014'
  if (/unit|plot|flat/.test(k)) return 'Plot A-12'
  if (/link|url/.test(k)) return 'https://anonindia.com'
  if (/address|location/.test(k)) return 'Ajmer Road, Jaipur'
  if (/festival/.test(k)) return 'Diwali'
  if (/name|customer|client/.test(k)) return 'Rahul'
  return 'details'
}
