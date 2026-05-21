import { createClient } from '@/lib/supabase/server'
import type { Automation, AutomationLog } from '@/types/automation'

export async function getAutomations(): Promise<Automation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automations')
    .select('*, creator:profiles!automations_created_by_fkey(full_name)')
    .eq('is_template', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Automation[]
}

export async function getAutomationById(id: string): Promise<Automation | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('automations')
    .select('*, creator:profiles!automations_created_by_fkey(full_name)')
    .eq('id', id)
    .single()
  return data as Automation | null
}

export async function getAutomationLogs(limit = 50): Promise<AutomationLog[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('automation_logs')
    .select('*, automation:automations(name, action_type)')
    .order('executed_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AutomationLog[]
}

export async function getAutomationStats() {
  const supabase = await createClient()
  const [automationsRes, logsRes] = await Promise.all([
    supabase.from('automations').select('id, is_active, run_count').eq('is_template', false),
    supabase.from('automation_logs').select('status, executed_at').gte('executed_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])
  const automations = automationsRes.data ?? []
  const logs = logsRes.data ?? []
  return {
    total: automations.length,
    active: automations.filter(a => a.is_active).length,
    totalRuns: automations.reduce((s, a) => s + (a.run_count ?? 0), 0),
    last7dFired: logs.length,
    last7dSuccess: logs.filter(l => l.status === 'success').length,
    last7dFailed: logs.filter(l => l.status === 'failed').length,
  }
}

export async function getPendingExecutions() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('automation_pending_executions')
    .select('*, automation:automations(name)')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(20)
  return data ?? []
}
