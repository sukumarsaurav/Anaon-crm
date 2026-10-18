'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Webhook } from 'lucide-react'

interface Connector {
  slug: string
  name: string
  description: string
}

const CONNECTORS: Connector[] = [
  { slug: '99acres', name: '99acres', description: 'Real-estate portal inquiries' },
  { slug: 'magicbricks', name: 'MagicBricks', description: 'Real-estate portal inquiries' },
  { slug: 'housing', name: 'Housing.com', description: 'Real-estate portal inquiries' },
  { slug: 'justdial', name: 'JustDial', description: 'JustDial business leads' },
  { slug: 'indiamart', name: 'IndiaMart', description: 'IndiaMart buyer inquiries' },
  { slug: 'linkedin', name: 'LinkedIn', description: 'LinkedIn lead-gen forms' },
  { slug: 'google-lead-form', name: 'Google Lead Form', description: 'Google Ads lead forms' },
  { slug: 'website', name: 'Website / Custom Form', description: 'Any custom form or webhook' },
]

export default function IntegrationsPanel({
  secret,
  appUrl,
  agencyxConfigured,
  agencyxSendConfigured,
}: {
  secret: string
  appUrl?: string
  agencyxConfigured: boolean
  agencyxSendConfigured: boolean
}) {
  const [origin, setOrigin] = useState(appUrl ?? '')
  const [copied, setCopied] = useState<string | null>(null)

  // Prefer the configured public URL; fall back to the browser origin.
  useEffect(() => {
    if (!appUrl) setOrigin(window.location.origin)
  }, [appUrl])

  const urlFor = (slug: string) =>
    `${origin || 'https://your-domain.com'}/api/webhooks/leads/${slug}?token=${secret}`

  const agencyxUrl = `${origin || 'https://your-domain.com'}/api/webhooks/agencyx`

  const copyAgencyx = async () => {
    await navigator.clipboard.writeText(agencyxUrl)
    setCopied('agencyx')
    setTimeout(() => setCopied(null), 1500)
  }

  const copy = async (slug: string) => {
    await navigator.clipboard.writeText(urlFor(slug))
    setCopied(slug)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Paste a source&apos;s webhook URL into that portal&apos;s lead-push / webhook
        settings. Incoming leads are de-duplicated by phone, auto-assigned, scored,
        and dropped straight into the pipeline. Expects a JSON body with common
        fields (<code>name</code>, <code>phone</code>, <code>email</code>,{' '}
        <code>requirement</code>, <code>city</code>, <code>budget</code>).
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CONNECTORS.map((c) => (
          <div key={c.slug} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Webhook size={16} className="text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
                {urlFor(c.slug)}
              </code>
              <button
                onClick={() => copy(c.slug)}
                className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
                title="Copy URL"
              >
                {copied === c.slug ? (
                  <Check size={15} className="text-green-600" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* AgencyX authenticates with a signature, not a ?token=, so its URL carries no
          secret and gets its own card with its own setup steps. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <Webhook size={16} className="text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">AgencyX (Facebook / Instagram Lead Ads, WhatsApp)</p>
            <p className="text-xs text-slate-500">Lead Ad forms and WhatsApp chats, forwarded by AgencyX</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
            {agencyxUrl}
          </code>
          <button
            onClick={copyAgencyx}
            className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
            title="Copy URL"
          >
            {copied === 'agencyx' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
        </div>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
          <li>In AgencyX, open <strong>Developers → Webhook endpoints → Add an endpoint</strong> and paste this URL.</li>
          <li>
            Tick <code>meta.lead.received</code> (Lead Ads), plus <code>whatsapp.message.received</code>,{' '}
            <code>whatsapp.message.sent</code>, <code>whatsapp.message.status</code> and{' '}
            <code>chatbot.lead.captured</code> to mirror AgencyX&apos;s WhatsApp chats, ticks and chatbot
            leads into the CRM — new contacts also become leads.
          </li>
          <li>Copy the signing secret AgencyX shows and set it as <code>AGENCYX_WEBHOOK_SECRET</code> on the CRM deployment, then redeploy.</li>
          <li>Press <strong>Send test</strong> in AgencyX — it should answer 200.</li>
          <li>
            Create a live key in AgencyX under <strong>Developers → Send API</strong> and set it as{' '}
            <code>AGENCYX_API_KEY</code>. With it, every WhatsApp the CRM sends goes through AgencyX: inbox
            replies, templates, broadcasts, bulk sends, automations and OTPs — and templates are submitted
            for WhatsApp approval from <strong>WhatsApp → Templates</strong>. Replying from the inbox
            switches AgencyX&apos;s bot off for that chat; the Bot ON/OFF button switches it back.
          </li>
        </ol>
        {!agencyxConfigured && (
          <p className="mt-2 text-xs text-amber-700">AGENCYX_WEBHOOK_SECRET is not set yet — AgencyX deliveries are rejected until it is.</p>
        )}
        {!agencyxSendConfigured && (
          <p className="mt-1 text-xs text-amber-700">AGENCYX_API_KEY is not set yet — the CRM cannot send WhatsApp through AgencyX.</p>
        )}
        {agencyxConfigured && agencyxSendConfigured && (
          <p className="mt-2 text-xs text-green-700">Connected — receiving and sending through AgencyX.</p>
        )}
      </div>
    </div>
  )
}
