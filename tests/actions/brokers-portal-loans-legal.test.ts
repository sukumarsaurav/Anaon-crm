import { world, resetWorld } from '../helpers/world'
import { describe, it, expect, beforeEach } from 'vitest'
import { grantBrokerPortalAccess, approveBroker, deactivateBroker, approveCommissionBatch, markCommissionPaidBatch, registerBrokerLead, updateLeadRegistrationStatus, createBroker } from '@/lib/brokers/actions'
import { createLoanApplication, updateLoanStage } from '@/lib/loans/actions'
import { eraseSubject } from '@/lib/legal/erasure'
import { updateDeletionRequestStatus } from '@/lib/legal/actions'
import { reviewExtensionRequest } from '@/lib/portal/actions'

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }

describe('broker portal access', () => {
  const broker = (o: any = {}) => ({ id: 'B1', full_name: 'Vikram', email: 'v@x.in', phone: '9871234501', status: 'approved', auth_user_id: null, ...o })
  beforeEach(() => resetWorld({ brokers: [broker()], profiles: [] }, {}, 'manager', 'mgr'))

  it('creates a broker-role login, links it, and returns a one-time password', async () => {
    const r: any = await grantBrokerPortalAccess('B1')
    expect(r.success).toBe(true)
    expect(r.tempPassword).toMatch(/^Br-/)
    const user = world.db.users[0]
    expect(user.app_metadata.role).toBe('broker')
    expect(world.db.rows('profiles')[0]).toMatchObject({ role: 'broker', is_active: true })
    expect(world.db.rows('brokers')[0].auth_user_id).toBe(user.id)
  })
  it('never hands out the same password twice', async () => {
    const a: any = await grantBrokerPortalAccess('B1')
    resetWorld({ brokers: [broker()], profiles: [] }, {}, 'manager', 'mgr')
    const b: any = await grantBrokerPortalAccess('B1')
    expect(a.tempPassword).not.toBe(b.tempPassword)
  })
  it('manager-only; broker must be approved, have an email, and not already have access', async () => {
    resetWorld({ brokers: [broker()] }, {}, 'sales_advisor')
    expect(((await grantBrokerPortalAccess('B1')) as any).success).toBe(false)
    resetWorld({ brokers: [broker({ status: 'pending' })] }, {}, 'manager')
    expect(((await grantBrokerPortalAccess('B1')) as any).error).toMatch(/Approve/)
    resetWorld({ brokers: [broker({ email: null })] }, {}, 'manager')
    expect(((await grantBrokerPortalAccess('B1')) as any).error).toMatch(/email/)
    resetWorld({ brokers: [broker({ auth_user_id: 'u' })] }, {}, 'manager')
    expect(((await grantBrokerPortalAccess('B1')) as any).error).toMatch(/already/)
  })
  it('never takes over an existing account (it could be a staff login)', async () => {
    world.db.users.push({ id: 'staff', email: 'V@X.in' })
    const r: any = await grantBrokerPortalAccess('B1')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/already has an account/)
    expect(world.db.rows('brokers')[0].auth_user_id).toBeNull()
  })
  it('deactivating bans the login; re-approving lifts the ban', async () => {
    await grantBrokerPortalAccess('B1')
    await deactivateBroker('B1')
    expect(world.db.users[0].banned).toBe(true)
    expect(world.db.rows('profiles')[0].is_active).toBe(false)
    await approveBroker('B1')
    expect(world.db.users[0].banned).toBe(false)
    expect(world.db.rows('profiles')[0].is_active).toBe(true)
  })
  it('createBroker starts pending and needs a manager', async () => {
    expect(((await createBroker(fd({ full_name: 'N', phone: '1' }))) as any).success).toBe(true)
    expect(world.db.rows('brokers').at(-1)).toMatchObject({ status: 'pending', invited_by: 'mgr' })
    resetWorld({}, {}, 'telecaller')
    expect(((await createBroker(fd({ full_name: 'N' }))) as any).success).toBe(false)
  })
})

describe('broker commissions', () => {
  beforeEach(() => resetWorld({ broker_commissions: [
    { id: 'c1', broker_id: 'B1', status: 'pending', commission_amount: 20000, brokers: { full_name: 'V', phone: '9', auth_user_id: 'bu' } },
    { id: 'c2', broker_id: 'B1', status: 'approved', commission_amount: 5000, brokers: { full_name: 'V', phone: '9', auth_user_id: null } },
  ] }, {}, 'manager', 'mgr'))

  it('batch approve only moves pending ones, fires the automation and notifies brokers with portal access', async () => {
    await approveCommissionBatch(['c1', 'c2'])
    expect(world.db.rows('broker_commissions').map((c) => c.status)).toEqual(['approved', 'approved'])
    expect(world.db.rows('broker_commissions')[0]).toMatchObject({ approved_by: 'mgr' })
    expect(world.automations.filter((a) => a.trigger === 'broker_commission_approved').length).toBeGreaterThan(0)
    expect(world.notifications.some((n) => n.ids[0] === 'bu')).toBe(true)
  })
  it('batch pay only moves approved ones and stores the UTR', async () => {
    await markCommissionPaidBatch(['c1', 'c2'], 'UTR123')
    expect(world.db.rows('broker_commissions').map((c) => c.status)).toEqual(['pending', 'paid'])
    expect(world.db.rows('broker_commissions')[1].utr_number).toBe('UTR123')
  })
  it('manager-only', async () => {
    resetWorld({ broker_commissions: [] }, {}, 'sales_advisor')
    expect(((await approveCommissionBatch(['c1'])) as any).success).toBe(false)
    expect(((await markCommissionPaidBatch(['c1'], 'U')) as any).success).toBe(false)
  })
})

describe('broker lead registration', () => {
  beforeEach(() => resetWorld({
    brokers: [{ id: 'B1', full_name: 'Vikram', status: 'approved', auth_user_id: 'bu' }, { id: 'B2', full_name: 'Pending', status: 'pending', auth_user_id: 'bu2' }],
    leads: [], lead_activities: [], assignment_rules: [], profiles: [{ id: 'a1', role: 'sales_advisor', is_active: true }], broker_lead_registrations: [],
  }, {}, 'broker', 'bu'))

  it('a new client becomes a CRM lead tagged with the broker, and a registered row', async () => {
    const r: any = await registerBrokerLead(fd({ client_name: 'Ravi', client_phone: '98100 01025' }))
    expect(r).toMatchObject({ success: true, isDuplicate: false })
    expect(world.db.rows('leads')[0]).toMatchObject({ source: 'broker', broker_id: 'B1', phone: '9810001025' })
    expect(world.db.rows('broker_lead_registrations')[0]).toMatchObject({ status: 'registered', crm_lead_id: world.db.rows('leads')[0].id })
  })
  it('a client that already exists is flagged duplicate and points at the existing lead', async () => {
    world.db.rows('leads').push({ id: 'old', phone: '9810001025', is_active: true })
    const r: any = await registerBrokerLead(fd({ client_name: 'Ravi', client_phone: '9810001025' }))
    expect(r.isDuplicate).toBe(true)
    expect(world.db.rows('broker_lead_registrations')[0]).toMatchObject({ status: 'duplicate', duplicate_of_lead_id: 'old', crm_lead_id: null })
    expect(world.db.rows('leads')).toHaveLength(1)
  })
  it('rejects bad numbers and brokers who are not approved', async () => {
    expect(((await registerBrokerLead(fd({ client_name: 'R', client_phone: '123' }))) as any).success).toBe(false)
    resetWorld({ brokers: [{ id: 'B2', status: 'pending', auth_user_id: 'bu' }] }, {}, 'broker', 'bu')
    expect(((await registerBrokerLead(fd({ client_name: 'R', client_phone: '9810001025' }))) as any).error).toMatch(/not approved/)
  })
  it('updateLeadRegistrationStatus is manager-only', async () => {
    resetWorld({ broker_lead_registrations: [{ id: 'r' }] }, {}, 'sales_advisor')
    expect(((await updateLeadRegistrationStatus('r', 'converted')) as any).success).toBe(false)
    resetWorld({ broker_lead_registrations: [{ id: 'r' }] }, {}, 'manager')
    expect(((await updateLeadRegistrationStatus('r', 'converted')) as any).success).toBe(true)
  })
})

describe('loans', () => {
  beforeEach(() => resetWorld({ loan_applications: [], clients: [{ id: 'C1' }] }, {}, 'sales_advisor', 'adv'))
  it('creates an application at the first stage with parsed numbers', async () => {
    const r: any = await createLoanApplication(fd({ client_id: 'C1', loan_amount_applied: '2500000', monthly_income: '90000', credit_score: '742', bank_tieup_id: '' }))
    expect(r.success).toBe(true)
    expect(world.db.rows('loan_applications')[0]).toMatchObject({ stage: 'eligibility_check', loan_amount_applied: 2500000, credit_score: 742, bank_tieup_id: null, created_by: 'adv' })
  })
  it('stage updates store the stage-specific fields', async () => {
    await createLoanApplication(fd({ client_id: 'C1' }))
    const id = world.db.rows('loan_applications')[0].id
    await updateLoanStage(id, 'sanction_received', fd({ sanctioned_amount: '2000000', sanctioned_interest_rate: '8.5', sanctioned_tenure_months: '240', sanction_date: '2026-10-01' }))
    expect(world.db.rows('loan_applications')[0]).toMatchObject({ stage: 'sanction_received', sanctioned_amount: 2000000, sanctioned_interest_rate: 8.5, sanctioned_tenure_months: 240 })
    await updateLoanStage(id, 'rejected', fd({ rejection_reason: 'low score', rejection_date: '2026-10-05' }))
    expect(world.db.rows('loan_applications')[0]).toMatchObject({ stage: 'rejected', rejection_reason: 'low score' })
  })
  it('requires a session', async () => {
    resetWorld({}, {}, null)
    expect(((await createLoanApplication(fd({ client_id: 'C1' }))) as any).success).toBe(false)
  })
})

describe('DPDP erasure', () => {
  const seed = () => ({
    leads: [{ id: 'L1', full_name: 'Sita', phone: '+91-9810001025', alternate_phone: '9810001099', email: 's@x.in', city: 'Jaipur', is_active: true }, { id: 'L2', full_name: 'Other', phone: '9000000000', is_active: true }],
    clients: [{ id: 'C1', lead_id: 'L1', full_name: 'Sita', phone: '+91-9810001025', email: 's@x.in', pan_encrypted: 'ABCDE1234F', aadhar_encrypted: '1234', co_applicant_name: 'Ram', nominee_name: 'Ram' }],
    client_documents: [{ id: 'd1', client_id: 'C1', file_url: 'https://x.supabase.co/storage/v1/object/public/kyc/c1/pan.pdf' }],
    lead_activities: [{ id: 'a1', lead_id: 'L1', notes: 'secret note', recording_url: 'http://rec' }, { id: 'a2', lead_id: 'L2', notes: 'keep me' }],
    site_visits: [{ id: 'v1', lead_id: 'L1', client_feedback: 'f', advisor_notes: 'n', notes: 'x', photos: ['p'] }],
    whatsapp_conversations: [{ id: 'w1', lead_id: 'L1', contact_phone: '919810001025' }, { id: 'w2', lead_id: null, contact_phone: '919810001099' }, { id: 'w3', lead_id: 'L2', contact_phone: '919000000000' }],
    whatsapp_messages: [{ id: 'm1', conversation_id: 'w1', media_url: 'whatsapp-media/a/b.jpg' }, { id: 'm2', conversation_id: 'w2' }, { id: 'm3', conversation_id: 'w3' }],
    chatbot_sessions: [{ id: 's1', conversation_id: 'w1' }],
    complaints: [{ id: 'k1', client_id: 'C1', description: 'private details', photo_urls: ['u'] }],
    broker_lead_registrations: [{ id: 'br', crm_lead_id: 'L1', client_name: 'Sita', client_phone: '9810001025', notes: 'n' }],
    portal_sessions: [{ id: 'ps', client_id: 'C1' }],
    bookings: [{ id: 'BK', client_id: 'C1', total_sale_value: 100 }], payments: [{ id: 'PAY', client_id: 'C1', amount_paid: 100 }],
    data_deletion_requests: [{ id: 'req', requester_type: 'lead', requester_id: 'L1', status: 'pending' }],
  })

  it('erasing a lead anonymises it and everything that identifies them, and nobody else', async () => {
    resetWorld(seed(), {}, 'admin')
    const r = await eraseSubject('lead', 'L1')
    expect(r).toMatchObject({ ok: true, errors: [] })
    expect(world.db.rows('leads')[0]).toMatchObject({ full_name: '[Deleted]', alternate_phone: null, email: null, city: null, is_active: false })
    expect(world.db.rows('leads')[0].phone).toMatch(/^deleted-/) // phone is NOT NULL: a placeholder, never null
    expect(world.db.rows('leads')[1]).toMatchObject({ full_name: 'Other', phone: '9000000000' })
    expect(world.db.rows('lead_activities').find((a) => a.id === 'a1')).toMatchObject({ notes: null, recording_url: null })
    expect(world.db.rows('lead_activities').find((a) => a.id === 'a2')!.notes).toBe('keep me')
    expect(world.db.rows('site_visits')[0]).toMatchObject({ client_feedback: null, advisor_notes: null, photos: [] })
    // WhatsApp: by lead link AND by phone (alternate number), but not other people's threads
    expect(world.db.rows('whatsapp_conversations').map((c) => c.id)).toEqual(['w3'])
    expect(world.db.rows('whatsapp_messages').map((m) => m.id)).toEqual(['m3'])
    expect(world.db.rows('chatbot_sessions')).toHaveLength(0)
    expect(world.db.rows('broker_lead_registrations')[0]).toMatchObject({ client_name: '[Deleted]', notes: null })
  })
  it('the linked client is erased too, KYC documents deleted, financial records kept', async () => {
    resetWorld(seed(), {}, 'admin')
    await eraseSubject('lead', 'L1')
    expect(world.db.rows('clients')[0]).toMatchObject({ full_name: '[Deleted]', email: null, pan_encrypted: null, aadhar_encrypted: null, co_applicant_name: null, nominee_name: null })
    expect(world.db.rows('client_documents')).toHaveLength(0)
    expect(world.db.rows('complaints')[0]).toMatchObject({ description: '[Deleted]', photo_urls: [] })
    expect(world.db.rows('portal_sessions')).toHaveLength(0)
    expect(world.db.rows('bookings')).toHaveLength(1)
    expect(world.db.rows('payments')[0].amount_paid).toBe(100)
  })
  it('erasing a client reaches its lead', async () => {
    resetWorld(seed(), {}, 'admin')
    await eraseSubject('client', 'C1')
    expect(world.db.rows('leads')[0].full_name).toBe('[Deleted]')
  })
  it('an unknown subject reports an error instead of claiming success', async () => {
    resetWorld(seed(), {}, 'admin')
    expect((await eraseSubject('lead', 'nope')).ok).toBe(false)
  })
  it('completing a request erases first and only then marks it completed', async () => {
    resetWorld(seed(), {}, 'manager')
    const r: any = await updateDeletionRequestStatus('req', 'completed', 'done')
    expect(r.success).toBe(true)
    expect(world.db.rows('data_deletion_requests')[0]).toMatchObject({ status: 'completed', processed_by: 'user-admin' })
    expect(world.db.rows('data_deletion_requests')[0].admin_notes).toContain('Erased')
    expect(world.db.rows('leads')[0].full_name).toBe('[Deleted]')
  })
  it('a failed erasure leaves the request OPEN so it can be retried', async () => {
    resetWorld(seed(), { beforeWrite: (t, op) => (t === 'leads' && op === 'update' ? { message: 'db error' } : null) }, 'manager')
    const r: any = await updateDeletionRequestStatus('req', 'completed')
    expect(r.success).toBe(false)
    expect(world.db.rows('data_deletion_requests')[0].status).toBe('pending')
  })
  it('manager-only; a request with no linked record cannot be auto-completed', async () => {
    resetWorld(seed(), {}, 'sales_advisor')
    expect(((await updateDeletionRequestStatus('req', 'completed')) as any).success).toBe(false)
    resetWorld({ data_deletion_requests: [{ id: 'req', requester_type: 'lead', requester_id: null }] }, {}, 'manager')
    expect(((await updateDeletionRequestStatus('req', 'completed')) as any).success).toBe(false)
  })
})

describe('payment extension review', () => {
  beforeEach(() => resetWorld({
    payment_extension_requests: [{ id: 'E1', payment_id: 'PAY', requested_date: '2026-12-01', status: 'pending' }],
    payments: [{ id: 'PAY', due_date: '2026-11-01', status: 'pending' }],
  }, {}, 'manager', 'mgr'))
  it('approving moves the installment due date and records the reviewer', async () => {
    expect(((await reviewExtensionRequest('E1', 'approved', 'ok')) as any).success).toBe(true)
    expect(world.db.rows('payments')[0].due_date).toBe('2026-12-01')
    expect(world.db.rows('payment_extension_requests')[0]).toMatchObject({ status: 'approved', reviewed_by: 'mgr', admin_notes: 'ok' })
  })
  it('rejecting leaves the due date alone', async () => {
    await reviewExtensionRequest('E1', 'rejected', 'no')
    expect(world.db.rows('payments')[0].due_date).toBe('2026-11-01')
  })
  it('manager-only and one review per request', async () => {
    resetWorld({ payment_extension_requests: [{ id: 'E1', status: 'pending' }] }, {}, 'sales_advisor')
    expect(((await reviewExtensionRequest('E1', 'approved')) as any).success).toBe(false)
    resetWorld({ payment_extension_requests: [{ id: 'E1', status: 'approved' }] }, {}, 'manager')
    expect(((await reviewExtensionRequest('E1', 'rejected')) as any).error).toMatch(/already reviewed/)
  })
})

import { getTopBrokers } from '@/lib/brokers/queries'
import { getBrokerCommissions } from '@/lib/reports/queries'

describe('broker rankings and the commission report', () => {
  const seedBrokers = () => ({
    brokers: ['Zed', 'Amit', 'Mona', 'Bela', 'Cara', 'Dev', 'Esha'].map((n, i) => ({ id: `B${i}`, full_name: n, status: 'approved', commission_rate: 1 + i * 0.25 })),
    broker_lead_registrations: [],
    broker_commissions: [{ id: 'c1', broker_id: 'B0', status: 'approved', commission_amount: 500000 }, { id: 'c2', broker_id: 'B6', status: 'paid', commission_amount: 100000 }, { id: 'c3', broker_id: 'B6', status: 'voided', commission_amount: 999999 }],
  })
  it('"top" brokers are ranked by earnings across ALL approved brokers, not the first names alphabetically', async () => {
    resetWorld(seedBrokers(), {}, 'manager')
    const top = await getTopBrokers(3)
    expect(top.map((b) => b.full_name)).toEqual(['Zed', 'Esha', 'Amit'])
    expect(top[0].total_commission_earned).toBe(500000)
    expect(top[1].total_commission_earned).toBe(100000) // voided does not count
  })
  it('the commission report maps brokers.full_name and commission_amount (the wrong column names emptied it)', async () => {
    resetWorld({ broker_commissions: [
      { id: 'c1', status: 'pending', commission_amount: 1000, broker: { full_name: 'Vikram', phone: '9' }, created_at: '2026-10-01' },
      { id: 'c2', status: 'approved', commission_amount: 2000, broker: { full_name: 'Vikram', phone: '9' }, created_at: '2026-10-02' },
      { id: 'c3', status: 'paid', commission_amount: 4000, broker: { full_name: 'Sunita', phone: '8' }, created_at: '2026-10-03' },
      { id: 'c4', status: 'voided', commission_amount: 8000, broker: null, created_at: '2026-10-04' },
    ] }, {}, 'admin')
    const r = await getBrokerCommissions()
    expect(r.due).toBe(3000)   // pending + approved
    expect(r.paid).toBe(4000)
    expect(r.commissions.find((c: any) => c.id === 'c3')).toMatchObject({ amount: 4000, broker: { name: 'Sunita' } })
  })
})
