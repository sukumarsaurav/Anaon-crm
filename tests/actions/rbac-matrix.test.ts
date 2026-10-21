import { world, resetWorld } from '../helpers/world'
import { describe, it, expect } from 'vitest'

import * as team from '@/lib/team/actions'
import * as hr from '@/lib/hr/actions'
import * as staff from '@/lib/team/staff'
import * as marketing from '@/lib/marketing/actions'
import * as automation from '@/lib/automation/actions'
import * as inventory from '@/lib/inventory/actions'
import * as whatsapp from '@/lib/whatsapp/actions'
import * as construction from '@/lib/construction/actions'
import * as legal from '@/lib/legal/actions'
import * as loans from '@/lib/loans/actions'
import * as brokers from '@/lib/brokers/actions'
import * as clients from '@/lib/clients/actions'
import * as bookings from '@/lib/bookings/actions'
import * as portal from '@/lib/portal/actions'
import { deleteLead, mergeDuplicate } from '@/lib/leads/actions'
import { createAssignmentRule, updateAssignmentRule, toggleAssignmentRule, deleteAssignmentRule } from '@/lib/leads/assignmentRules'

const fd = (o: Record<string, string> = {}) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f }
const ruleInput = { name: 'r', priority: 1, is_active: true, match_sources: null, match_property_types: null, match_cities: null, budget_min: null, budget_max: null, assign_mode: 'round_robin' as const, assign_to: null, assign_pool: null }

type Call = [string, () => Promise<any>]
/** Actions only managers/admins may run. Each must refuse lower roles — even if the database would too. */
const managerOnly: Call[] = [
  ['team.setMonthlyTarget', () => team.setMonthlyTarget(fd({ user_id: 'x', month: '2026-10-01' }))],
  ['team.markAttendance', () => team.markAttendance('x', '2026-10-01', 'present')],
  ['team.reviewLeave', () => team.reviewLeave('x', true)],
  ['team.createAnnouncement', () => team.createAnnouncement(fd({ title: 't', body: 'b' }))],
  ['team.pinAnnouncement', () => team.pinAnnouncement('x', true)],
  ['team.updateMemberProfile', () => team.updateMemberProfile('x', fd({ full_name: 'n' }))],
  ['hr.updateCandidateStage', () => hr.updateCandidateStage('x', 'screening' as any)],
  ['hr.makeOffer', () => hr.makeOffer('x', fd())],
  ['hr.updateEmployee', () => hr.updateEmployee('x', fd({ full_name: 'n' }))],
  ['hr.deactivateEmployee', () => hr.deactivateEmployee('x', 'r')],
  ['hr.reactivateEmployee', () => hr.reactivateEmployee('x')],
  ['construction.deleteMilestone', () => construction.deleteMilestone('x', 'p')],
  // Managers may deactivate within their own team; staff below manager may not.
  ['team.toggleMemberActive', () => team.toggleMemberActive('x', false)],
  ['hr.approveLeave', () => hr.approveLeave('x')],
  ['hr.rejectLeave', () => hr.rejectLeave('x', 'n')],
  ['hr.setLeaveBalance', () => hr.setLeaveBalance(fd())],
  ['marketing.createCampaign', () => marketing.createCampaign(fd({ name: 'c' }))],
  ['marketing.deleteCampaign', () => marketing.deleteCampaign('x')],
  ['marketing.logCampaignSpend', () => marketing.logCampaignSpend(fd())],
  ['automation.createAutomation', () => automation.createAutomation(fd({ name: 'a', trigger_event: 'lead_created', action_type: 'send_notification', action_payload: '{}' }))],
  ['automation.toggleAutomation', () => automation.toggleAutomation('x', true)],
  ['automation.deleteAutomation', () => automation.deleteAutomation('x')],
  ['inventory.createProject', () => inventory.createProject(fd({ name: 'p' }))],
  ['inventory.updateProject', () => inventory.updateProject('x', fd({ name: 'p' }))],
  ['inventory.createPlot', () => inventory.createPlot(fd({ project_id: 'x' }))],
  ['inventory.updatePlot', () => inventory.updatePlot('x', fd())],
  ['inventory.schedulePriceEscalation', () => inventory.schedulePriceEscalation(fd({ project_id: 'x' }))],
  ['inventory.savePremiumMatrix', () => inventory.savePremiumMatrix('x', [])],
  ['whatsapp.createTemplate', () => whatsapp.createTemplate(fd({ name: 'n' }))],
  ['whatsapp.deleteTemplate', () => whatsapp.deleteTemplate('x')],
  ['whatsapp.toggleTemplateActive', () => whatsapp.toggleTemplateActive('x', true)],
  ['whatsapp.createBroadcast', () => whatsapp.createBroadcast(fd())],
  ['whatsapp.sendBroadcast', () => whatsapp.sendBroadcast('x')],
  ['whatsapp.cancelBroadcast', () => whatsapp.cancelBroadcast('x')],
  ['whatsapp.saveAutoReplyRule', () => whatsapp.saveAutoReplyRule(fd({ name: 'r', trigger_type: 'keyword', response_type: 'text' }))],
  ['legal.updateProjectRERA', () => legal.updateProjectRERA('x', fd())],
  ['legal.updateDeletionRequestStatus', () => legal.updateDeletionRequestStatus('x', 'completed')],
  ['legal.toggleLegalTemplate', () => legal.toggleLegalTemplate('x', true)],
  ['loans.createBankTieup', () => loans.createBankTieup(fd({ bank_name: 'b' }))],
  ['loans.toggleDSA', () => loans.toggleDSA('x', true)],
  ['brokers.createBroker', () => brokers.createBroker(fd({ full_name: 'n' }))],
  ['brokers.approveBroker', () => brokers.approveBroker('x')],
  ['brokers.rejectBroker', () => brokers.rejectBroker('x', 'r')],
  ['brokers.deactivateBroker', () => brokers.deactivateBroker('x')],
  ['brokers.grantBrokerPortalAccess', () => brokers.grantBrokerPortalAccess('x')],
  ['brokers.approveCommissionBatch', () => brokers.approveCommissionBatch(['x'])],
  ['brokers.markCommissionPaidBatch', () => brokers.markCommissionPaidBatch(['x'], 'u')],
  ['clients.recordPayment', () => clients.recordPayment('x', fd({ amount_paid: '1' }))],
  ['clients.waivePayment', () => clients.waivePayment('x')],
  ['clients.updateKycStatus', () => clients.updateKycStatus('x', 'verified')],
  ['clients.verifyClientDocument', () => clients.verifyClientDocument('x', 'verified')],
  ['clients.assignComplaint', () => clients.assignComplaint('x', 'y')],
  ['bookings.approveBooking', () => bookings.approveBooking('x')],
  ['bookings.rejectBooking', () => bookings.rejectBooking('x', 'r')],
  ['bookings.cancelBooking', () => bookings.cancelBooking('x', fd({ reason: 'r' }))],
  ['bookings.addBookingInstallment', () => bookings.addBookingInstallment(fd())],
  ['portal.reviewExtensionRequest', () => portal.reviewExtensionRequest('x', 'approved')],
  ['leads.mergeDuplicate', () => mergeDuplicate('a', 'b')],
  // Managers may delete their own announcements (RLS: author or admin); below manager, never.
  ['team.deleteAnnouncement', () => team.deleteAnnouncement('x')],
]
const adminOnly: Call[] = [
  ['leads.deleteLead', () => deleteLead('x')],
  ['team.changeStaffAssignment', () => staff.changeStaffAssignment('x', { role: 'admin' })],
  ['hr.createPayrollRun', () => hr.createPayrollRun(fd())],
  ['hr.finalizePayrollRun', () => hr.finalizePayrollRun('x')],
  ['hr.updatePayrollSlip', () => hr.updatePayrollSlip('x', fd())],
  ['assignmentRules.create', () => createAssignmentRule(ruleInput)],
  ['assignmentRules.update', () => updateAssignmentRule('x', ruleInput)],
  ['assignmentRules.toggle', () => toggleAssignmentRule('x', false)],
  ['assignmentRules.delete', () => deleteAssignmentRule('x')],
]

const AUTH_MESSAGE = /forbidden|unauthori[sz]ed|insufficient|only (admins?|managers?)|admin only|not authenticated|permission|sign in/i
/** Refused FOR AUTHORISATION REASONS — an action failing on bad arguments or a missing row would otherwise look "denied". */
const denied = (r: any) => (r?.success === false || r?.ok === false) && AUTH_MESSAGE.test(String(r?.error ?? ''))

describe('role-based access (manager/admin-only actions)', () => {
  for (const role of ['telecaller', 'sales_advisor', 'broker'] as const) {
    it(`${role} is refused every manager-only action`, async () => {
      const allowed: string[] = []
      for (const [name, call] of managerOnly) {
        resetWorld({}, {}, role, 'u')
        let r: any
        try { r = await call() } catch (e) { r = { success: false, error: (e as Error).message } }
        if (!denied(r)) allowed.push(name)
      }
      expect(allowed, `actions a ${role} could run`).toEqual([])
    })
  }
  for (const role of ['telecaller', 'sales_advisor', 'manager'] as const) {
    it(`${role} is refused every admin-only action`, async () => {
      const allowed: string[] = []
      for (const [name, call] of adminOnly) {
        resetWorld({}, {}, role, 'u')
        let r: any
        try { r = await call() } catch (e) { r = { success: false, error: (e as Error).message } }
        if (!denied(r)) allowed.push(name)
      }
      expect(allowed, `actions a ${role} could run`).toEqual([])
    })
  }
  it('with no session, every action is refused', async () => {
    const allowed: string[] = []
    for (const [name, call] of [...managerOnly, ...adminOnly]) {
      resetWorld({}, {}, null)
      let r: any
      try { r = await call() } catch (e) { r = { success: false, error: (e as Error).message } }
      if (!denied(r)) allowed.push(name)
    }
    expect(allowed).toEqual([])
  })
  it('a manager is NOT refused (the matrix is not simply denying everything)', async () => {
    resetWorld({ marketing_campaigns: [{ id: 'x' }], payments: [{ id: 'x', status: 'pending', amount_due: 1, amount_paid: 0 }] }, {}, 'manager', 'm')
    expect((await marketing.deleteCampaign('x')).success).toBe(true)
    expect(((await clients.waivePayment('x')) as any).success).toBe(true)
  })
})
