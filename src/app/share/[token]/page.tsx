export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Building2, MapPin, Phone, MessageSquare, FileText, CalendarClock, ShieldCheck } from 'lucide-react'
import { getAlbumByToken, recordAlbumView } from '@/lib/albums/queries'
import { formatCurrency } from '@/lib/utils'

interface PageProps {
  params: Promise<{ token: string }>
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[]
  return []
}

export default async function SharedAlbumPage({ params }: PageProps) {
  const { token } = await params

  const album = await getAlbumByToken(token)
  if (!album) notFound()

  // Log the view (best-effort, never blocks render).
  const h = await headers()
  recordAlbumView(token, h.get('user-agent'), h.get('referer')).catch(() => {})

  const project = album.project
  const gallery = toStringArray(project?.gallery_urls)
  const amenities = toStringArray(project?.amenities)
  const repPhone = album.created_by_phone

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Branding header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div className="leading-none">
            <p className="font-bold text-slate-900 text-sm">ANON INDIA</p>
            <p className="text-xs text-slate-400">Real Estate</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Title + personalization */}
        <div>
          {album.client_name && (
            <p className="text-sm text-blue-600 font-medium">Prepared for {album.client_name}</p>
          )}
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{album.title}</h1>
          {album.message && <p className="text-slate-600 mt-2">{album.message}</p>}
        </div>

        {/* Gallery */}
        {gallery.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gallery.slice(0, 6).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`${project?.name ?? 'Project'} ${i + 1}`}
                className="w-full h-32 object-cover rounded-xl border border-slate-200" />
            ))}
          </div>
        )}

        {project && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                <MapPin size={14} />
                {[project.locality, project.city].filter(Boolean).join(', ') || project.address || '—'}
              </p>
            </div>
            {project.description && <p className="text-sm text-slate-600">{project.description}</p>}

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {project.expected_completion_date && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <CalendarClock size={14} className="text-slate-400" />
                  Possession {new Date(project.expected_completion_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              )}
              {project.rera_number && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck size={14} className="text-green-600" />
                  RERA {project.rera_number}
                </span>
              )}
            </div>

            {/* Resource links */}
            <div className="flex flex-wrap gap-2">
              {project.layout_image_url && (
                <a href={project.layout_image_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-blue-300">
                  <MapPin size={13} /> Layout / Floor Plan
                </a>
              )}
              {project.brochure_url && (
                <a href={project.brochure_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-blue-300">
                  <FileText size={13} /> Brochure
                </a>
              )}
              {project.google_maps_pin && (
                <a href={project.google_maps_pin} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-blue-300">
                  <MapPin size={13} /> Location on Map
                </a>
              )}
            </div>

            {amenities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map((a) => (
                    <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Units */}
        {album.plots.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Available Units</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                    <th className="px-5 py-2.5 text-left">Unit</th>
                    <th className="px-5 py-2.5 text-left">Config</th>
                    <th className="px-5 py-2.5 text-right">Size</th>
                    <th className="px-5 py-2.5 text-left">Facing</th>
                    <th className="px-5 py-2.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {album.plots.map((p, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5 font-medium text-slate-800">{p.plot_number}</td>
                      <td className="px-5 py-2.5 text-slate-600">{p.configuration ?? '—'}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">
                        {p.size_sqyd ? `${p.size_sqyd} sq.yd` : p.size_sqft ? `${p.size_sqft} sq.ft` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600 capitalize">{p.facing ?? '—'}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(p.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contact CTA */}
        {repPhone && (
          <div className="bg-blue-600 rounded-2xl p-5 text-center text-white">
            <p className="font-semibold">Interested? Talk to {album.created_by_name ?? 'our team'}</p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <a href={`tel:${repPhone}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 rounded-xl text-sm font-semibold">
                <Phone size={15} /> Call
              </a>
              <a href={`https://wa.me/91${repPhone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold">
                <MessageSquare size={15} /> WhatsApp
              </a>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-2">© ANON INDIA Real Estate</p>
      </main>
    </div>
  )
}
