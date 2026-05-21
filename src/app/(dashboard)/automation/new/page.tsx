export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import AutomationBuilder from '@/components/automation/AutomationBuilder'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewAutomationPage() {
  const supabase = await createClient()

  const { data: advisors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['sales_advisor', 'manager'])
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/automation" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Automation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define a trigger and an action to automate your workflow</p>
        </div>
      </div>

      <AutomationBuilder advisors={advisors ?? []} />
    </div>
  )
}
