import { formatCurrency, formatDate } from '@/lib/utils'
import type { DemandLetterData } from '@/types/bookings'

export default function DemandLetterView({ data }: { data: DemandLetterData }) {
  const { booking, payment } = data
  const { client, plot, project } = booking

  const lateCharge = Math.round(payment.amount_due * data.late_charge_pct)

  return (
    <div className="max-w-2xl mx-auto bg-white p-10 print:p-8 font-serif">
      {/* Letterhead */}
      <div className="text-center border-b-2 border-indigo-700 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-indigo-700 tracking-wide">ANON INDIA</h1>
        <p className="text-sm text-slate-500 mt-1">Real Estate Developers</p>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-slate-900 underline underline-offset-4">DEMAND LETTER</h2>
        <p className="text-sm text-slate-500 mt-2">
          Booking: {booking.booking_number} &nbsp;|&nbsp;
          Installment #{payment.installment_number} &nbsp;|&nbsp;
          Date: {formatDate(data.generated_at)}
        </p>
      </div>

      {/* Addressee */}
      <div className="mb-6">
        <p className="font-bold text-slate-900">{client?.full_name ?? '—'}</p>
        {client?.permanent_address && (
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{client.permanent_address}</p>
        )}
      </div>

      <p className="mb-4 text-sm text-slate-700 leading-relaxed">
        Dear {client?.full_name ?? 'Applicant'},
      </p>

      <p className="mb-6 text-sm text-slate-700 leading-relaxed">
        This is to inform you that the following payment installment is due against your booking of
        Plot No. <strong>{plot?.plot_number}</strong> in Project <strong>{project?.name}</strong>.
        Please arrange to remit the payment on or before the due date to avoid late payment charges.
      </p>

      {/* Demand table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="text-left px-4 py-2.5 font-medium">Particulars</th>
              <th className="text-right px-4 py-2.5 font-medium">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-4 py-2.5 text-slate-700">
                Installment #{payment.installment_number}
                {payment.description ? ` — ${payment.description}` : ''}
              </td>
              <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(payment.amount_due)}</td>
            </tr>
            {payment.late_charge > 0 && (
              <tr className="border-b border-slate-200">
                <td className="px-4 py-2.5 text-red-600">Late Payment Charges</td>
                <td className="px-4 py-2.5 text-right text-red-600 font-medium">{formatCurrency(payment.late_charge)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-50">
              <td className="px-4 py-3 font-bold text-indigo-800">Total Amount Due</td>
              <td className="px-4 py-3 text-right font-bold text-indigo-800 text-base">
                {formatCurrency(payment.amount_due + (payment.late_charge ?? 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Due date highlight */}
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
        <p className="text-sm font-bold text-red-700">
          Payment Due Date: {formatDate(payment.due_date)}
        </p>
        <p className="text-xs text-red-500 mt-1">
          A late payment charge of {data.late_charge_pct}% per day (approx. {formatCurrency(lateCharge)}/day)
          will be levied on the outstanding amount after the due date.
        </p>
      </div>

      {/* Bank details */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-4 mb-8">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Payment Details (NEFT / RTGS)</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-500">Bank Name:</span> <span className="font-medium">{data.bank_name}</span></div>
          <div><span className="text-slate-500">IFSC Code:</span> <span className="font-medium font-mono">{data.ifsc}</span></div>
          <div className="col-span-2"><span className="text-slate-500">Account Number:</span> <span className="font-medium font-mono">{data.account_number}</span></div>
          <div className="col-span-2"><span className="text-slate-500">Account Name:</span> <span className="font-medium">ANON INDIA DEVELOPERS PVT LTD</span></div>
        </div>
        <p className="text-xs text-slate-400 mt-2">After transfer, share UTR number at accounts@anonindiagroup.com</p>
      </div>

      {/* Signature */}
      <div className="border-t border-slate-300 pt-4 mt-8">
        <p className="text-sm font-semibold text-slate-700">For ANON INDIA</p>
        <p className="text-sm text-slate-500 mt-4">Authorised Signatory</p>
        <p className="text-xs text-slate-400 mt-0.5">Date: {formatDate(data.generated_at)}</p>
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
