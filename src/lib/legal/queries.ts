import { createClient } from '@/lib/supabase/server'
import type { LegalDocumentTemplate, DataDeletionRequest, ConsentLog, RERAComplianceStatus } from '@/types/legal'
import type { DocumentCategory } from '@/types/inventory'

export async function getLegalDocumentTemplates(): Promise<LegalDocumentTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('legal_document_templates')
    .select('*, creator:profiles!legal_document_templates_created_by_fkey(full_name)')
    .order('type', { ascending: true })
    .order('created_at', { ascending: false })
  return (data ?? []) as LegalDocumentTemplate[]
}

export async function getDataDeletionRequests(): Promise<DataDeletionRequest[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('data_deletion_requests')
    .select('*, processor:profiles!data_deletion_requests_processed_by_fkey(full_name)')
    .order('requested_at', { ascending: false })
    .limit(100)
  return (data ?? []) as DataDeletionRequest[]
}

export async function getConsentStats() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('consent_logs')
    .select('consent_type, consented')
  const logs = data ?? []
  const byType: Record<string, { total: number; opted_in: number }> = {}
  for (const log of logs) {
    if (!byType[log.consent_type]) byType[log.consent_type] = { total: 0, opted_in: 0 }
    byType[log.consent_type].total++
    if (log.consented) byType[log.consent_type].opted_in++
  }
  return byType
}

export async function getConsentLogs(entityType?: 'lead' | 'client', limit = 50): Promise<ConsentLog[]> {
  const supabase = await createClient()
  let query = supabase
    .from('consent_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (entityType) query = query.eq('entity_type', entityType)
  const { data } = await query
  return (data ?? []) as ConsentLog[]
}

export async function getPrivacyStats() {
  const supabase = await createClient()
  const [deletionRes, consentRes] = await Promise.all([
    supabase.from('data_deletion_requests').select('status'),
    supabase.from('consent_logs').select('consent_type, consented'),
  ])
  const requests = deletionRes.data ?? []
  const logs = consentRes.data ?? []
  return {
    totalRequests:  requests.length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    completedRequests: requests.filter(r => r.status === 'completed').length,
    totalConsentLogs: logs.length,
    optedIn: logs.filter(l => l.consented).length,
    optedOut: logs.filter(l => !l.consented).length,
  }
}

// Compute per-project RERA compliance status
export async function getAllProjectsRERAStatus(): Promise<RERAComplianceStatus[]> {
  const supabase = await createClient()

  const [projectsRes, docsRes] = await Promise.all([
    supabase.from('projects')
      .select('id, name, rera_number, rera_expiry_date, quarterly_report_due_date')
      .eq('is_active', true)
      .order('name'),
    supabase.from('project_documents')
      .select('project_id, category'),
  ])

  const projects = projectsRes.data ?? []
  const docs = docsRes.data ?? []

  const now = new Date()

  return projects.map(p => {
    const projectDocs = docs.filter(d => d.project_id === p.id).map(d => d.category as DocumentCategory)
    const hasDoc = (cat: DocumentCategory) => projectDocs.includes(cat)

    let daysUntilExpiry: number | null = null
    if (p.rera_expiry_date) {
      daysUntilExpiry = Math.floor((new Date(p.rera_expiry_date).getTime() - now.getTime()) / 86400000)
    }

    const hasRERADoc    = hasDoc('rera_certificate')
    const hasTitleDeed  = hasDoc('title_deed')
    const hasLayout     = hasDoc('layout_approval')
    const hasFireNOC    = hasDoc('noc')
    const hasBankApproval = hasDoc('bank_approval')
    const hasEnvClear   = hasDoc('environmental_clearance')

    // Score: 25 pts RERA number + 15 each mandatory doc (RERA cert, title, layout, NOC) = 25+60=85 + 10 for expiry valid + 5 quarterly ok
    let score = 0
    if (p.rera_number) score += 25
    if (hasRERADoc) score += 15
    if (hasTitleDeed) score += 15
    if (hasLayout) score += 15
    if (hasFireNOC) score += 15
    if (daysUntilExpiry !== null && daysUntilExpiry > 0) score += 10
    if (!quarterlyDue(p.quarterly_report_due_date)) score += 5

    const quarterlyReportDue = quarterlyDue(p.quarterly_report_due_date)

    let alertLevel: 'ok' | 'warning' | 'critical' = 'ok'
    if (daysUntilExpiry !== null && daysUntilExpiry <= 0) alertLevel = 'critical'
    else if (daysUntilExpiry !== null && daysUntilExpiry <= 60) alertLevel = 'warning'
    else if (score < 55 || quarterlyReportDue) alertLevel = 'warning'

    return {
      projectId: p.id,
      projectName: p.name,
      reraNumber: p.rera_number,
      reraExpiryDate: p.rera_expiry_date,
      daysUntilExpiry,
      hasRERADoc,
      hasTitleDeed,
      hasLayoutApproval: hasLayout,
      hasFireNOC,
      hasBankApproval,
      hasEnvClearance: hasEnvClear,
      complianceScore: Math.min(100, score),
      quarterlyReportDue,
      alertLevel,
    }
  })
}

function quarterlyDue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) <= new Date()
}

export async function getProjectRERADetail(projectId: string) {
  const supabase = await createClient()
  const [projectRes, docsRes] = await Promise.all([
    supabase.from('projects')
      .select('id, name, rera_number, rera_registration_date, rera_expiry_date, rera_authority_name, rera_website_url, carpet_area_sqft, fsi_approved, total_approved_units, quarterly_report_last_submitted, quarterly_report_due_date, rera_disclosures, legal_contact')
      .eq('id', projectId)
      .single(),
    supabase.from('project_documents')
      .select('id, name, category, file_url, created_at, uploader:profiles!project_documents_uploaded_by_fkey(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ])
  return { project: projectRes.data, documents: docsRes.data ?? [] }
}

export async function getLegalStats() {
  const supabase = await createClient()
  const [projectsRes, docsRes, requestsRes, templatesRes] = await Promise.all([
    supabase.from('projects').select('id, rera_number, rera_expiry_date').eq('is_active', true),
    supabase.from('project_documents').select('project_id, category'),
    supabase.from('data_deletion_requests').select('status'),
    supabase.from('legal_document_templates').select('id').eq('is_active', true),
  ])

  const projects = projectsRes.data ?? []
  const now = new Date()
  const expiringSoon = projects.filter(p => {
    if (!p.rera_expiry_date) return false
    const days = Math.floor((new Date(p.rera_expiry_date).getTime() - now.getTime()) / 86400000)
    return days >= 0 && days <= 60
  }).length
  const expired = projects.filter(p => {
    if (!p.rera_expiry_date) return false
    return new Date(p.rera_expiry_date) < now
  }).length
  const pendingDeletions = (requestsRes.data ?? []).filter(r => r.status === 'pending').length

  return {
    totalProjects: projects.length,
    reraRegistered: projects.filter(p => p.rera_number).length,
    expiringSoon,
    expired,
    totalDocuments: (docsRes.data ?? []).length,
    pendingDeletions,
    totalTemplates: (templatesRes.data ?? []).length,
  }
}
