import { createClient } from '@/lib/supabase/server'
import type { BankTieup, DSA, LoanApplication, LoanDisbursement, LoanStage } from '@/types/loans'

// ── Bank tie-ups ───────────────────────────────────────────────────────────

export async function getBankTieups(activeOnly = false): Promise<BankTieup[]> {
  const supabase = await createClient()
  let q = supabase.from('bank_tieups').select('*').order('bank_name')
  if (activeOnly) q = q.eq('is_active', true)
  const { data } = await q
  return (data ?? []) as BankTieup[]
}

export async function getBankTieupById(id: string): Promise<BankTieup | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('bank_tieups').select('*').eq('id', id).single()
  return data as BankTieup | null
}

// ── DSAs ───────────────────────────────────────────────────────────────────

export async function getDSAs(activeOnly = false): Promise<DSA[]> {
  const supabase = await createClient()
  let q = supabase.from('dsas').select('*').order('name')
  if (activeOnly) q = q.eq('is_active', true)
  const { data } = await q
  return (data ?? []) as DSA[]
}

export async function getDSAById(id: string): Promise<DSA | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('dsas').select('*').eq('id', id).single()
  return data as DSA | null
}

// ── Loan applications ──────────────────────────────────────────────────────

export async function getLoanApplications(stage?: LoanStage): Promise<LoanApplication[]> {
  const supabase = await createClient()
  let q = supabase
    .from('loan_applications')
    .select(`
      *,
      client:clients!loan_applications_client_id_fkey(id, full_name, phone),
      bank:bank_tieups!loan_applications_bank_tieup_id_fkey(id, bank_name, loan_product_name),
      dsa:dsas!loan_applications_dsa_id_fkey(id, name, firm_name)
    `)
    .order('updated_at', { ascending: false })
  if (stage) q = q.eq('stage', stage)
  const { data } = await q
  return (data ?? []) as LoanApplication[]
}

export async function getLoanApplicationById(id: string): Promise<LoanApplication | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('loan_applications')
    .select(`
      *,
      client:clients!loan_applications_client_id_fkey(id, full_name, phone),
      bank:bank_tieups!loan_applications_bank_tieup_id_fkey(id, bank_name, loan_product_name, rm_name, rm_phone, interest_rate, interest_type, max_loan_pct, turnaround_days),
      dsa:dsas!loan_applications_dsa_id_fkey(id, name, firm_name, contact_phone),
      disbursements:loan_disbursements(*, milestone:construction_milestones!loan_disbursements_milestone_id_fkey(name))
    `)
    .eq('id', id)
    .single()
  return data as LoanApplication | null
}

export async function getLoanApplicationsByClient(clientId: string): Promise<LoanApplication[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('loan_applications')
    .select(`
      *,
      bank:bank_tieups!loan_applications_bank_tieup_id_fkey(id, bank_name, loan_product_name),
      dsa:dsas!loan_applications_dsa_id_fkey(id, name)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return (data ?? []) as LoanApplication[]
}

// ── Disbursements ──────────────────────────────────────────────────────────

export async function getPendingDisbursements(): Promise<LoanDisbursement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('loan_disbursements')
    .select('*, loan:loan_applications(client_id, client:clients!loan_applications_client_id_fkey(full_name)), milestone:construction_milestones!loan_disbursements_milestone_id_fkey(name, status)')
    .in('status', ['pending', 'delayed'])
    .order('expected_date', { ascending: true })
    .limit(20)
  return (data ?? []) as unknown as LoanDisbursement[]
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getLoanStats() {
  const supabase = await createClient()
  const [appsRes, disbRes, banksRes, dsasRes] = await Promise.all([
    supabase.from('loan_applications').select('stage, sanctioned_amount, loan_amount_applied'),
    supabase.from('loan_disbursements').select('status, actual_amount, expected_amount'),
    supabase.from('bank_tieups').select('id').eq('is_active', true),
    supabase.from('dsas').select('id').eq('is_active', true),
  ])

  const apps = appsRes.data ?? []
  const disbs = disbRes.data ?? []

  const activeStages = ['eligibility_check','bank_selected','application_submitted','docs_submitted','sanction_received','disbursement']
  const active = apps.filter(a => activeStages.includes(a.stage))
  const sanctioned = apps.filter(a => a.sanctioned_amount)
  const totalSanctioned = sanctioned.reduce((s, a) => s + (a.sanctioned_amount ?? 0), 0)
  const totalDisbursed = disbs.filter(d => d.status === 'received').reduce((s, d) => s + (d.actual_amount ?? 0), 0)
  const pendingDisbs = disbs.filter(d => d.status === 'pending').length
  const delayedDisbs = disbs.filter(d => d.status === 'delayed').length

  const byStage: Record<string, number> = {}
  for (const a of apps) {
    byStage[a.stage] = (byStage[a.stage] ?? 0) + 1
  }

  return {
    totalApplications: apps.length,
    activeApplications: active.length,
    rejected: apps.filter(a => a.stage === 'rejected').length,
    totalSanctioned,
    totalDisbursed,
    pendingDisbursements: pendingDisbs,
    delayedDisbursements: delayedDisbs,
    activeBanks: banksRes.data?.length ?? 0,
    activeDSAs: dsasRes.data?.length ?? 0,
    byStage,
  }
}
