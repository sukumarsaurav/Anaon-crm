/**
 * Which compliance alerts are due today. Pure (no I/O) so the rules are testable; the cron
 * (app/api/cron/compliance-alerts) stores each one once and notifies people.
 */

export interface AlertProject {
  id: string
  name: string
  rera_expiry_date: string | null
  quarterly_report_due_date: string | null
}

export interface DueAlert {
  project_id: string
  kind: 'rera_expiry' | 'quarterly_report' | 'missing_documents'
  /** Unique per project + kind; includes the date it is about so a renewal starts fresh. */
  threshold: string
  title: string
  message: string
  severity: 'critical' | 'warning'
}

export const EXPIRY_DAYS = [90, 60, 30, 15, 7, 1, 0]
export const QUARTERLY_DAYS = [15, 7, 3, 1, 0]
/** Mandatory documents (the RERA checklist items marked required). */
export const REQUIRED_DOCS: { key: string; label: string }[] = [
  { key: 'rera_certificate', label: 'RERA registration certificate' },
  { key: 'title_deed', label: 'Title report / deed' },
  { key: 'layout_approval', label: 'Layout approval' },
  { key: 'noc', label: 'Fire NOC' },
]

const DAY = 86_400_000
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Before the date: on each threshold day. On/after it: that day, then every 7 days. */
function dueOn(today: string, target: string, before: number[]): number | null {
  const left = days(today, target)
  if (left > 0) return before.includes(left) ? left : null
  return -left % 7 === 0 ? left : null
}

export function dueAlerts(projects: AlertProject[], docsByProject: Map<string, Set<string>>, today: string): DueAlert[] {
  const out: DueAlert[] = []
  const monday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1

  for (const p of projects) {
    if (p.rera_expiry_date) {
      const d = dueOn(today, p.rera_expiry_date, EXPIRY_DAYS)
      if (d !== null) {
        const expired = d <= 0
        out.push({
          project_id: p.id, kind: 'rera_expiry', threshold: `${p.rera_expiry_date}:${d}`,
          severity: expired || d <= 30 ? 'critical' : 'warning',
          title: expired ? `RERA registration expired — ${p.name}` : `RERA registration expires in ${d} day${d === 1 ? '' : 's'} — ${p.name}`,
          message: expired
            ? `${p.name}'s RERA registration expired on ${fmt(p.rera_expiry_date)}${d < 0 ? ` (${-d} days ago)` : ''}. New bookings are blocked until it is renewed.`
            : `${p.name}'s RERA registration expires on ${fmt(p.rera_expiry_date)}. Apply for the extension in time.`,
        })
      }
    }
    if (p.quarterly_report_due_date) {
      const d = dueOn(today, p.quarterly_report_due_date, QUARTERLY_DAYS)
      if (d !== null) {
        const overdue = d < 0
        out.push({
          project_id: p.id, kind: 'quarterly_report', threshold: `${p.quarterly_report_due_date}:${d}`,
          severity: d <= 1 ? 'critical' : 'warning',
          title: overdue ? `Quarterly RERA report overdue — ${p.name}` : d === 0 ? `Quarterly RERA report due today — ${p.name}` : `Quarterly RERA report due in ${d} days — ${p.name}`,
          message: `${p.name}: quarterly progress report due ${fmt(p.quarterly_report_due_date)}${overdue ? ` (${-d} days overdue)` : ''}. Mark it submitted under Legal once filed.`,
        })
      }
    }
    if (monday) {
      const have = docsByProject.get(p.id) ?? new Set<string>()
      const missing = REQUIRED_DOCS.filter((r) => !have.has(r.key))
      if (missing.length) {
        out.push({
          project_id: p.id, kind: 'missing_documents', threshold: today, severity: 'warning',
          title: `Compliance documents missing — ${p.name}`,
          message: `${p.name} is missing: ${missing.map((m) => m.label).join(', ')}. Upload them under Legal → ${p.name}.`,
        })
      }
    }
  }
  return out
}
