import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getTeamMembers, getMonthlyTargets } from '@/lib/team/queries'
import { istMonthYear } from '@/lib/datetime'
import { MONTH_NAMES } from '@/types/hr'
import TargetsTable from '@/components/team/TargetsTable'

export const metadata = { title: 'Monthly Targets' }

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<{ month?: string; year?: string; member?: string }> }

export default async function TargetsPage({ searchParams }: Props) {
  const session = await getProfile()
  const role = session?.profile?.role
  if (role !== 'admin' && role !== 'manager') redirect('/team')

  const sp = await searchParams
  const current = istMonthYear()
  const m = parseInt(sp.month ?? '', 10), y = parseInt(sp.year ?? '', 10)
  const month = m >= 1 && m <= 12 ? m : current.month
  const year = y >= 2020 && y <= 2100 ? y : current.year

  // Your own target is set by your manager, so you are not listed here.
  const members = (await getTeamMembers())
    .filter((mem) => (mem.role === 'sales_advisor' || mem.role === 'telecaller') && mem.id !== session?.user?.id)
  const targets = await getMonthlyTargets(members.map((mem) => mem.id), month, year)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Targets</h1>
          <p className="text-sm text-slate-500 mt-1">{MONTH_NAMES[month]} {year}</p>
        </div>
        <form method="GET" className="flex items-center gap-2">
          <select aria-label="Month" name="month" defaultValue={month}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
            {MONTH_NAMES.slice(1).map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
          <input aria-label="Year" name="year" type="number" min={2020} max={2100} defaultValue={year}
            className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5" />
          <button type="submit" className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Show</button>
        </form>
      </div>
      <TargetsTable key={`${month}-${year}`} members={members} targets={targets} month={month} year={year} initialMemberId={sp.member} />
    </div>
  )
}
