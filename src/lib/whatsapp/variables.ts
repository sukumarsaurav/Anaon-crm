/**
 * Fills a template's variables from what the CRM knows about the recipient.
 *
 * Variable names come from two places: templates written in the CRM ("name",
 * "project_name") and templates synced from AgencyX, which carry whatever label was given
 * in AgencyX's builder ("Customer name", "Project") or "1", "2"… when unlabelled. So the
 * match is on meaning, not on an exact key.
 */
export interface TemplateContext {
  name?: string | null
  project?: string | null
  advisor_name?: string | null
  advisor_phone?: string | null
  amount?: string | number | null
  due_date?: string | null
  date?: string | null
  time?: string | null
  booking_no?: string | null
  unit?: string | null
  link?: string | null
  /** Explicit values, by variable name, win over everything above. */
  overrides?: Record<string, string>
}

function valueFor(rawName: string, ctx: TemplateContext): string | null {
  if (ctx.overrides?.[rawName]) return ctx.overrides[rawName]
  const k = rawName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const has = (...words: string[]) => words.some((w) => k.includes(w))

  // Most specific first: "project name" and "advisor name" both contain "name".
  if (has('project', 'property', 'site')) return ctx.project ?? null
  if (has('advisor', 'agent', 'executive', 'manager', 'rm')) {
    return has('phone', 'mobile', 'number', 'contact') ? ctx.advisor_phone ?? null : ctx.advisor_name ?? null
  }
  if (has('phone', 'mobile', 'contact')) return ctx.advisor_phone ?? null
  if (has('amount', 'price', 'due amount', 'rs', 'inr')) return ctx.amount != null ? String(ctx.amount) : null
  if (has('due')) return ctx.due_date ?? null
  if (has('date', 'day')) return ctx.date ?? ctx.due_date ?? null
  if (has('time', 'slot')) return ctx.time ?? null
  if (has('booking')) return ctx.booking_no ?? null
  if (has('unit', 'plot', 'flat')) return ctx.unit ?? null
  if (has('link', 'url')) return ctx.link ?? null
  if (has('name', 'customer', 'client', 'lead')) return ctx.name ?? null
  // An unlabelled AgencyX template: {{1}} is the customer's name in practice.
  if (k === '1') return ctx.name ?? null
  return null
}

/**
 * Values in variable order. `missing` lists the names nothing could fill — WhatsApp
 * rejects an empty parameter, so a caller should not send while it is non-empty.
 */
export function fillTemplateVariables(names: string[], ctx: TemplateContext): { values: string[]; missing: string[] } {
  const missing: string[] = []
  const values = names.map((n) => {
    const v = valueFor(n, ctx)?.toString().replace(/\s+/g, ' ').trim()
    if (!v) {
      missing.push(n)
      return ''
    }
    return v
  })
  return { values, missing }
}
