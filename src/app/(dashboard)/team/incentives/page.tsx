import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { createClient } from '@/lib/supabase/server'
import IncentiveSlabsEditor from '@/components/team/IncentiveSlabsEditor'
import type { IncentiveSlab } from '@/types/team'

export const metadata = { title: 'Incentive Slabs' }

export const dynamic = 'force-dynamic'

/** Admins edit; managers see the slabs their team is paid on. */
export default async function IncentivesPage() {
  const role = (await getProfile())?.profile?.role
  if (role !== 'admin' && role !== 'manager') redirect('/team')

  const supabase = await createClient()
  const { data } = await supabase.from('incentive_slabs').select('*').order('sort_order')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Incentive Slabs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Used for the incentive tracker on each advisor’s page and pre-filled on payslips when payroll is generated (finalized payslips never change).
        </p>
      </div>
      <IncentiveSlabsEditor slabs={(data ?? []) as IncentiveSlab[]} canEdit={role === 'admin'} />
    </div>
  )
}
