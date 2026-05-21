import { formatCurrency, formatDate } from '@/lib/utils'
import { PROJECT_TYPE_LABELS } from '@/types/inventory'
import type { AllotmentLetterData } from '@/types/bookings'

export default function AllotmentLetterView({ data }: { data: AllotmentLetterData }) {
  const { booking } = data
  const { client, plot, project } = booking

  return (
    <div className="max-w-2xl mx-auto bg-white p-10 print:p-8 font-serif">
      {/* Letterhead */}
      <div className="text-center border-b-2 border-indigo-700 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-indigo-700 tracking-wide">ANON INDIA</h1>
        <p className="text-sm text-slate-500 mt-1">Real Estate Developers</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {project?.address ?? project?.city ?? ''} &nbsp;|&nbsp; CIN: XXXXXXXXXXXX
        </p>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-slate-900 underline underline-offset-4 tracking-wide">
          ALLOTMENT LETTER
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Ref: {booking.booking_number} &nbsp;|&nbsp; Date: {formatDate(booking.booking_date)}
        </p>
      </div>

      {/* Addressee */}
      <div className="mb-6">
        <p className="font-bold text-slate-900">{client?.full_name ?? '—'}</p>
        {client?.permanent_address && (
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{client.permanent_address}</p>
        )}
        {client?.phone && <p className="text-sm text-slate-600">Ph: {client.phone}</p>}
      </div>

      {/* Salutation */}
      <p className="mb-4 text-sm text-slate-700">Dear {client?.full_name ?? 'Applicant'},</p>

      <p className="mb-4 text-sm text-slate-700 leading-relaxed">
        We are pleased to inform you that the following property has been allotted to you subject to
        the terms and conditions of the Booking Agreement executed between you and ANON INDIA.
      </p>

      {/* Property table */}
      <table className="w-full mb-6 border border-slate-300 text-sm">
        <thead>
          <tr className="bg-indigo-600 text-white">
            <th className="text-left px-4 py-2 font-medium">Particulars</th>
            <th className="text-left px-4 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Project Name',        project?.name ?? '—'],
            ['Project Type',        project?.type ? (PROJECT_TYPE_LABELS[project.type as keyof typeof PROJECT_TYPE_LABELS] ?? project.type) : '—'],
            ['RERA Number',         project?.rera_number ?? 'Applied for'],
            ['Plot Number',         plot?.plot_number ?? '—'],
            ['Plot Area',           plot?.size_sqyd ? `${plot.size_sqyd} sq yards` : plot?.size_sqft ? `${plot.size_sqft} sq ft` : '—'],
            ['Facing',              plot?.facing?.replace('_', '-').toUpperCase() ?? '—'],
            ['Total Sale Value',    formatCurrency(booking.total_sale_value)],
            ['Booking Amount Paid', formatCurrency(booking.booking_amount)],
            ['Balance Payable',     formatCurrency(booking.total_sale_value - booking.booking_amount)],
            ['Payment Plan',        booking.payment_plan ?? 'As per agreement'],
            ['Booking Date',        formatDate(booking.booking_date)],
            ['Expected Possession', booking.expected_possession_date ? formatDate(booking.expected_possession_date) : 'As per construction schedule'],
          ].map(([label, value]) => (
            <tr key={label} className="border-b border-slate-200">
              <td className="px-4 py-2 text-slate-600 font-medium w-1/2">{label}</td>
              <td className="px-4 py-2 text-slate-900">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-sm text-slate-700 mb-6 leading-relaxed">
        The allotment is subject to: (a) timely payment of all installments as per the agreed payment
        schedule; (b) compliance with all rules, regulations, and bye-laws applicable to the project;
        (c) execution of formal Agreement to Sale within 30 days from the date of this letter.
      </p>

      {/* Signature blocks */}
      <div className="grid grid-cols-2 gap-16 mt-12">
        <div className="border-t border-slate-400 pt-3">
          <p className="text-sm font-semibold text-slate-700">Authorised Signatory</p>
          <p className="text-sm text-slate-500 mt-1">ANON INDIA</p>
          <p className="text-xs text-slate-400 mt-0.5">Date: {formatDate(data.generated_at)}</p>
        </div>
        <div className="border-t border-slate-400 pt-3">
          <p className="text-sm font-semibold text-slate-700">Applicant&apos;s Signature</p>
          <p className="text-sm text-slate-500 mt-1">{client?.full_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">Date: ___________</p>
        </div>
      </div>

      <div className="mt-10 p-4 bg-slate-50 rounded-lg text-xs text-slate-400 leading-relaxed">
        <p>* This is a computer-generated allotment letter. The allotment is subject to legal verification and execution of formal Sale Agreement.</p>
        <p className="mt-1">* For any queries, contact: accounts@anonindiagroup.com | +91-XXXXXXXXXX</p>
      </div>

      <button
        onClick={() => window.print()}
        className="print:hidden mt-6 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
      >
        🖨 Print / Save as PDF
      </button>
    </div>
  )
}
