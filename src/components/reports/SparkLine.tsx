interface Props {
  data: { date: string; count: number }[]
  height?: number
  strokeColor?: string
  fillColor?: string
}

export default function SparkLine({
  data,
  height = 80,
  strokeColor = '#6366f1',
  fillColor = '#eef2ff',
}: Props) {
  if (data.length < 2) return <div className="h-20 flex items-center justify-center text-xs text-slate-300">No data</div>

  const width = 600
  const max = Math.max(...data.map(d => d.count), 1)
  const min = 0
  const padX = 4
  const padY = 4

  const x = (i: number) => padX + (i / (data.length - 1)) * (width - padX * 2)
  const y = (v: number) => padY + ((max - v) / (max - min)) * (height - padY * 2)

  const pts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ')
  const area = `M ${x(0)},${height} L ${pts.split(' ').map((p, i) => i === 0 ? p.replace(',', ',') : p).join(' L ')} L ${x(data.length - 1)},${height} Z`

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <path d={area} fill={fillColor} opacity="0.6" />
        <polyline points={pts} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots at last value */}
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].count)} r="4" fill={strokeColor} />
      </svg>
      <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}
