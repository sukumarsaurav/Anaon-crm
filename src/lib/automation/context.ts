import type { SupabaseClient } from '@supabase/supabase-js'
import type { AutomationContext, TriggerEvent } from '@/types/automation'

/**
 * Builds the automation context for a real record, the same shape the callers (lead actions, crons,
 * webhooks) pass when the trigger fires. Used by the test run so a preview shows what production
 * would do. Plain module; pass the signed-in user's client so RLS limits which records can be used.
 */

export type SubjectKind = 'lead' | 'booking' | 'payment' | 'client' | 'complaint' | 'milestone' | 'broker'

export const TRIGGER_SUBJECT: Record<TriggerEvent, SubjectKind> = {
  lead_created: 'lead', lead_stage_changed: 'lead', lead_assigned: 'lead', follow_up_overdue: 'lead',
  site_visit_scheduled: 'lead', site_visit_reminder: 'lead', site_visit_completed: 'lead',
  booking_created: 'booking', booking_anniversary: 'booking',
  payment_received: 'payment', payment_due_approaching: 'payment', payment_overdue: 'payment',
  milestone_completed: 'milestone', complaint_raised: 'complaint', client_birthday: 'client',
  broker_commission_approved: 'broker',
}

export const SUBJECT_LABEL: Record<SubjectKind, string> = {
  lead: 'lead', booking: 'booking', payment: 'installment', client: 'client', complaint: 'complaint', milestone: 'milestone', broker: 'broker',
}

/** Supabase types a to-one embed as an array; take the row either way. */
const one = <T,>(v: unknown): T | null => ((Array.isArray(v) ? v[0] : v) as T | undefined) ?? null

/** Recent records to try the automation on. */
export async function listSamples(supabase: SupabaseClient, kind: SubjectKind): Promise<{ id: string; label: string }[]> {
  switch (kind) {
    case 'lead': {
      const { data } = await supabase.from('leads').select('id, full_name, phone, stage').eq('is_active', true).order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((l) => ({ id: l.id, label: `${l.full_name} · ${l.phone} · ${String(l.stage).replace(/_/g, ' ')}` }))
    }
    case 'booking': {
      const { data } = await supabase.from('bookings').select('id, booking_number, client:clients!bookings_client_id_fkey(full_name)').order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((b) => ({ id: b.id, label: `${b.booking_number} · ${one<{ full_name: string }>(b.client)?.full_name ?? ''}` }))
    }
    case 'payment': {
      const { data } = await supabase.from('payments').select('id, installment_number, amount_due, due_date, client:clients(full_name)').order('due_date', { ascending: false }).limit(15)
      return (data ?? []).map((p) => ({ id: p.id, label: `${one<{ full_name: string }>(p.client)?.full_name ?? 'Client'} · #${p.installment_number} · ₹${Number(p.amount_due ?? 0).toLocaleString('en-IN')} due ${p.due_date ?? ''}` }))
    }
    case 'client': {
      const { data } = await supabase.from('clients').select('id, full_name, phone').neq('full_name', '[Deleted]').order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((c) => ({ id: c.id, label: `${c.full_name} · ${c.phone}` }))
    }
    case 'complaint': {
      const { data } = await supabase.from('complaints').select('id, category, client:clients(full_name)').order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((c) => ({ id: c.id, label: `${one<{ full_name: string }>(c.client)?.full_name ?? 'Client'} · ${c.category ?? 'complaint'}` }))
    }
    case 'milestone': {
      const { data } = await supabase.from('construction_milestones').select('id, name, project:projects(name)').order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((m) => ({ id: m.id, label: `${one<{ name: string }>(m.project)?.name ?? 'Project'} · ${m.name}` }))
    }
    case 'broker': {
      const { data } = await supabase.from('brokers').select('id, full_name, phone').order('created_at', { ascending: false }).limit(15)
      return (data ?? []).map((b) => ({ id: b.id, label: `${b.full_name} · ${b.phone ?? ''}` }))
    }
  }
}

export async function buildContext(supabase: SupabaseClient, trigger: TriggerEvent, recordId: string): Promise<AutomationContext | null> {
  const kind = TRIGGER_SUBJECT[trigger]
  switch (kind) {
    case 'lead': {
      const { data: l } = await supabase.from('leads')
        .select('id, full_name, phone, email, source, stage, assigned_to, project_id, utm_source, score').eq('id', recordId).maybeSingle()
      if (!l) return null
      return { lead: { ...l, source: l.source ?? undefined, stage: l.stage ?? undefined, score: l.score != null ? Number(l.score) : null } }
    }
    case 'booking': {
      const { data: b } = await supabase.from('bookings')
        .select('id, booking_date, project_id, client_id, client:clients!bookings_client_id_fkey(full_name, phone, email), project:projects!bookings_project_id_fkey(name)')
        .eq('id', recordId).maybeSingle()
      if (!b) return null
      const c = one<{ full_name: string; phone: string; email: string | null }>(b.client)
      const p = one<{ name: string }>(b.project)
      return {
        booking: { id: b.id, booking_date: b.booking_date ?? undefined, project_id: b.project_id ?? undefined },
        client: c ? { id: b.client_id, ...c } : undefined,
        project: p && b.project_id ? { id: b.project_id, name: p.name } : undefined,
      }
    }
    case 'payment': {
      const { data: p } = await supabase.from('payments')
        .select('id, amount_due, due_date, client_id, client:clients(full_name, phone, email)').eq('id', recordId).maybeSingle()
      if (!p) return null
      const c = one<{ full_name: string; phone: string; email: string | null }>(p.client)
      const overdue = p.due_date ? Math.round((Date.now() - Date.parse(`${p.due_date}T00:00:00+05:30`)) / 86_400_000) : 0
      return {
        payment: { id: p.id, amount_due: Number(p.amount_due), due_date: p.due_date ?? undefined },
        client: c ? { id: p.client_id, ...c } : undefined,
        extra: trigger === 'payment_overdue' ? { daysOverdue: Math.max(1, overdue) } : undefined,
      }
    }
    case 'client': {
      const { data: c } = await supabase.from('clients').select('id, full_name, phone, email, date_of_birth').eq('id', recordId).maybeSingle()
      return c ? { client: c } : null
    }
    case 'complaint': {
      const { data: k } = await supabase.from('complaints').select('id, category, client_id, client:clients(full_name, phone, email)').eq('id', recordId).maybeSingle()
      if (!k) return null
      const c = one<{ full_name: string; phone: string; email: string | null }>(k.client)
      return { complaint: { id: k.id, category: k.category ?? undefined }, client: c ? { id: k.client_id, ...c } : undefined }
    }
    case 'milestone': {
      const { data: m } = await supabase.from('construction_milestones').select('id, name, project_id, project:projects(name)').eq('id', recordId).maybeSingle()
      if (!m) return null
      // In production it fires once per client with a booking in the project; preview with the first.
      const { data: b } = await supabase.from('bookings')
        .select('client_id, client:clients!bookings_client_id_fkey(full_name, phone, email)')
        .eq('project_id', m.project_id).eq('status', 'confirmed').limit(1).maybeSingle()
      const c = one<{ full_name: string; phone: string; email: string | null }>(b?.client)
      return {
        milestone: { id: m.id, name: m.name, project_id: m.project_id },
        project: { id: m.project_id, name: one<{ name: string }>(m.project)?.name ?? '' },
        client: c && b ? { id: b.client_id, ...c } : undefined,
      }
    }
    case 'broker': {
      // The commission-approved trigger passes the broker as the "lead" (name and phone).
      const { data: br } = await supabase.from('brokers').select('id, full_name, phone, email').eq('id', recordId).maybeSingle()
      return br ? { lead: { id: br.id, full_name: br.full_name, phone: br.phone ?? '', email: br.email } } : null
    }
  }
}
