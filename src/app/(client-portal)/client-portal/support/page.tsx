export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import { getPortalClientData } from '@/lib/portal/queries'
import { Phone, MessageSquare, Mail, Building2 } from 'lucide-react'

const FAQS = [
  {
    q: 'When will my plot be handed over?',
    a: 'Possession dates are as per your booking agreement. Check the Construction Progress section for the latest milestone updates. We will notify you via WhatsApp and this portal when possession is ready.',
  },
  {
    q: 'How do I pay my next installment?',
    a: 'Contact your advisor or our accounts team for a payment link or bank transfer details. You can also request a payment extension from the Payments section if needed.',
  },
  {
    q: 'I need a copy of my allotment letter or agreement.',
    a: 'All available documents are in the Documents section. If a document is missing, raise a complaint or contact your advisor.',
  },
  {
    q: 'How do I update my KYC documents?',
    a: 'Please contact your ANON INDIA advisor directly or raise a complaint with category "Document Issue" and we will guide you through the process.',
  },
  {
    q: 'My payment shows as overdue but I paid it.',
    a: 'Payment updates may take 2–3 business days. If it has been longer, please contact accounts at accounts@aноnindia.com with your transaction reference.',
  },
]

export default async function ClientPortalSupportPage() {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const data = await getPortalClientData(session.client.id)
  const advisor = data.booking?.advisor

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support</h1>
        <p className="text-sm text-slate-500 mt-0.5">Get help from your dedicated advisor</p>
      </div>

      {/* Advisor card */}
      {advisor ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {advisor.full_name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-indigo-900">{advisor.full_name}</p>
              <p className="text-sm text-indigo-600">Your Dedicated Advisor</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {advisor.phone && (
              <a href={`tel:${advisor.phone}`}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                <Phone size={16} /> Call Now
              </a>
            )}
            {advisor.phone && (
              <a href={`https://wa.me/${advisor.phone.replace(/\D/g, '')}?text=Hi%2C%20I%20need%20help%20with%20my%20property`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-green-500 border border-green-500 rounded-xl text-sm font-medium text-white hover:bg-green-600">
                <MessageSquare size={16} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-600">No advisor assigned yet. Contact ANON INDIA office directly.</p>
        </div>
      )}

      {/* Company contact */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">ANON INDIA</h3>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Building2 size={16} className="text-slate-400" />
          <span>Main Office · Jaipur, Rajasthan</span>
        </div>
        <a href="mailto:support@aноnindia.com" className="flex items-center gap-3 text-sm text-indigo-600 hover:underline">
          <Mail size={16} />
          <span>support@aноnindia.com</span>
        </a>
        <a href="tel:+911234567890" className="flex items-center gap-3 text-sm text-indigo-600 hover:underline">
          <Phone size={16} />
          <span>+91 12345 67890</span>
        </a>
      </div>

      {/* FAQs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">Frequently Asked Questions</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {FAQS.map((faq, i) => (
            <details key={i} className="group p-5">
              <summary className="text-sm font-medium text-slate-900 cursor-pointer list-none flex items-center justify-between">
                {faq.q}
                <span className="text-slate-400 group-open:rotate-180 transition-transform text-lg">+</span>
              </summary>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
