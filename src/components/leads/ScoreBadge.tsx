import { cn } from '@/lib/utils'

export default function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-red-700 bg-red-50 border-red-200'
      : score >= 50
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-blue-700 bg-blue-50 border-blue-200'

  const barColor = score >= 80 ? 'bg-red-500' : score >= 50 ? 'bg-amber-400' : 'bg-blue-400'

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('inline-flex text-xs font-semibold px-1.5 py-0.5 rounded border', color)}>
        {score}
      </span>
    </div>
  )
}
