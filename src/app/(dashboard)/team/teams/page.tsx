export const dynamic = 'force-dynamic'

import { getTeamsData } from '@/lib/team/teams'
import TeamTree from '@/components/team/TeamTree'

export default async function TeamsPage() {
  const data = await getTeamsData()
  if (!data) return null

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Teams</h1>
        <p className="text-sm text-slate-500">
          Your team chain. Add juniors beneath you — they (and you) report up the hierarchy.
        </p>
      </div>
      <TeamTree data={data} />
    </div>
  )
}
