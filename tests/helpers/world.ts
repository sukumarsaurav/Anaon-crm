/**
 * db.ts wiring + stubs for the side-effect modules (automations, notifications, receipt email), with
 * spies on `world.automations` / `world.notifications`. Import this FIRST in action/route tests.
 */
import { vi } from 'vitest'
import * as core from './db'
export const world = core.world
export const resetWorld = core.resetWorld

vi.mock('@/lib/automation/engine', () => ({
  fireAutomations: (trigger: string, ctx: any, recordType?: string, recordId?: string) => {
    core.world.automations.push({ trigger, ctx, recordType, recordId })
    return Promise.resolve()
  },
}))
vi.mock('@/lib/notifications/notify', () => ({
  notifyUsers: async (ids: string[], input: any) => { core.world.notifications.push({ ids, input }) },
}))
vi.mock('@/lib/email/send', () => ({ sendReceiptEmail: async () => {} }))
