import { formatCurrency, formatDate } from '@/lib/utils'
import { PROJECT_TYPE_LABELS } from '@/types/inventory'
import type { CostSheet } from '@/types/inventory'

interface Props {
  data: CostSheet
}

function Row({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <tr className={bold ? 'bg-slate-50 font-semibold' : ''}>
      <td className="py-2 px-4 text-sm text-slate-700 border-b border-slate-100">{label}</td>
      <td className="py-2 px-4 text-sm text-right border-b border-slate-100">{formatCurrency(amount)}</td>
    </tr>
  )
}

export default function CostSheetView({ data }: Props) {
  const { plot, project } = data

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 print:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-indigo-600">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">ANON INDIA</h1>
          <p className="text-sm text-slate-500">Real Estate Developers</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-slate-800">COST SHEET</h2>
          <p className="text-xs text-slate-400">Generated: {formatDate(data.generated_at)}</p>
        </div>
      </div>

      {/* Project + Plot info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Project</p>
          <p className="font-semibold text-slate-900">{project.name}</p>
          <p className="text-sm text-slate-600">{PROJECT_TYPE_LABELS[project.type]}</p>
          <p className="text-sm text-slate-600">{project.city}{project.locality ? `, ${project.locality}` : ''}</p>
          {project.rera_number && (
            <p className="text-xs text-slate-400 mt-1">RERA: {project.rera_number}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Plot Details</p>
          <p className="font-semibold text-slate-900">Plot No. {plot.plot_number}</p>
          {plot.size_sqyd && <p className="text-sm text-slate-600">Area: {plot.size_sqyd} sq yards</p>}
          {plot.size_sqft && <p className="text-sm text-slate-600">({plot.size_sqft} sq ft)</p>}
          <p className="text-sm text-slate-600 capitalize">Type: {plot.type.replace('_', ' ')}</p>
          {plot.facing && <p className="text-sm text-slate-600">Facing: {plot.facing.replace('_', '-').toUpperCase()}</p>}
        </div>
      </div>

      {/* Price breakdown */}
      <table className="w-full mb-6 border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-indigo-600 text-white">
            <th className="text-left py-2 px-4 text-sm font-medium">Particulars</th>
            <th className="text-right py-2 px-4 text-sm font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Base Price" amount={data.base_price} />
          {data.premiums.map((p) => <Row key={p.label} label={p.label} amount={p.amount} />)}
          {data.total_premium > 0 && <Row label="Total Premiums" amount={data.total_premium} bold />}
          {data.development_charges > 0 && <Row label="Development Charges" amount={data.development_charges} />}
          <Row label="Sub Total" amount={data.sub_total} bold />
          <Row label={`Registration & Stamp Duty (est. ${project.type === 'apartment' ? '7' : '6'}%)`} amount={data.registration_charges} />
          {data.gst > 0 && <Row label="GST (5%)" amount={data.gst} />}
        </tbody>
        <tfoot>
          <tr className="bg-indigo-50">
            <td className="py-3 px-4 font-bold text-indigo-800">Total Payable</td>
            <td className="py-3 px-4 text-right font-bold text-indigo-800 text-lg">{formatCurrency(data.total_payable)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      <div className="text-xs text-slate-400 space-y-1 mb-6">
        <p>* This is an indicative cost sheet. Actual charges may vary.</p>
        <p>* Registration & stamp duty charges are estimated and depend on the registered circle rate.</p>
        <p>* GST applicable on construction-linked payments only (for apartments).</p>
        <p>* Prices are valid for 7 days from date of generation.</p>
      </div>

      {/* Print button */}
      <button
        onClick={() => window.print()}
        className="print:hidden px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
      >
        🖨 Print / Save as PDF
      </button>
    </div>
  )
}
