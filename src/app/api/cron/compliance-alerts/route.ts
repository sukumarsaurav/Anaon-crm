import { NextRequest, NextResponse } from 'next/server'
import { checkBearer } from '@/lib/security/secrets'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyUsers } from '@/lib/notifications/notify'
import { sendEmail, emailConfigured } from '@/lib/email/client'
import { genericEmail } from '@/lib/email/templates'
import { todayIST } from '@/lib/datetime'
import { dueAlerts, type AlertProject } from '@/lib/legal/alerts'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Daily compliance alerts: RERA expiry, quarterly report due / overdue, and (Mondays) missing
 * mandatory documents. Each alert is stored once in compliance_alerts, so re-runs never repeat it.
 * Admins and managers get an in-app notification per alert; admins and each project's legal
 * contact get one email digest.
 *   GET|POST /api/cron/compliance-alerts   Authorization: Bearer <CRON_SECRET>
 */
async function handler(req: NextRequest) {
  if (!checkBearer(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const svc = createServiceClient()
  const today = todayIST()

  const [{ data: projects, error }, { data: docs }] = await Promise.all([
    svc.from('projects').select('id, name, rera_expiry_date, quarterly_report_due_date, legal_contact_email').eq('is_active', true),
    svc.from('project_documents').select('project_id, category'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const docsBy = new Map<string, Set<string>>()
  for (const d of docs ?? []) {
    if (!docsBy.has(d.project_id)) docsBy.set(d.project_id, new Set())
    docsBy.get(d.project_id)!.add(d.category)
  }
  const due = dueAlerts((projects ?? []) as AlertProject[], docsBy, today)
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 })

  // Claim: only rows that weren't there already come back.
  const { data: fresh, error: insErr } = await svc.from('compliance_alerts')
    .upsert(due.map(({ project_id, kind, threshold, message }) => ({ project_id, kind, threshold, message })),
      { onConflict: 'project_id,kind,threshold', ignoreDuplicates: true })
    .select('project_id, kind, threshold')
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  const isFresh = new Set((fresh ?? []).map((r) => `${r.project_id}|${r.kind}|${r.threshold}`))
  const toSend = due.filter((a) => isFresh.has(`${a.project_id}|${a.kind}|${a.threshold}`))
  if (!toSend.length) return NextResponse.json({ ok: true, sent: 0 })

  const { data: staff } = await svc.from('profiles').select('id, role, email').in('role', ['admin', 'manager']).eq('is_active', true)
  const ids = (staff ?? []).map((p) => p.id)
  for (const a of toSend) {
    await notifyUsers(ids, { title: a.title, message: a.message, type: 'system', related_type: 'project', related_id: a.project_id, action_url: `/legal/${a.project_id}` })
  }

  let emailed = 0
  if (emailConfigured()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const digest = (alerts: typeof toSend) =>
      alerts.map((a) => `• ${a.title}\n  ${a.message}\n  ${appUrl}/legal/${a.project_id}`).join('\n\n')
    const adminEmails = (staff ?? []).filter((p) => p.role === 'admin' && p.email).map((p) => p.email as string)
    if (adminEmails.length) {
      const tpl = genericEmail(`Compliance alerts — ${toSend.length} item${toSend.length === 1 ? '' : 's'}`, digest(toSend))
      for (const to of adminEmails) if ((await sendEmail({ to, subject: tpl.subject, html: tpl.html })).success) emailed++
    }
    for (const p of projects ?? []) {
      const mine = toSend.filter((a) => a.project_id === p.id)
      if (!mine.length || !p.legal_contact_email) continue
      const tpl = genericEmail(`Compliance alerts — ${p.name}`, digest(mine))
      if ((await sendEmail({ to: p.legal_contact_email, subject: tpl.subject, html: tpl.html })).success) emailed++
    }
  }

  return NextResponse.json({ ok: true, sent: toSend.length, notified: ids.length, emailed })
}

export const GET = handler
export const POST = handler
