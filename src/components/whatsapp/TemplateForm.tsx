'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTemplate } from '@/lib/whatsapp/actions'
import { namedVariables, sampleValueFor } from '@/lib/whatsapp/template-render'
import { validateTemplateButtons } from '@/lib/whatsapp/template-buttons'
import type { WaTemplateButton } from '@/types/whatsapp'

const INPUT = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export default function TemplateForm({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')

  // Extract variables from body in real-time
  const variables = namedVariables(body)
  const [submitNow, setSubmitNow] = useState(canSubmit)
  const [category, setCategory] = useState('marketing')
  const [buttons, setButtons] = useState<WaTemplateButton[]>([])
  const buttonError = buttons.length ? validateTemplateButtons(buttons) : null

  function setButton(i: number, patch: Partial<WaTemplateButton>) {
    setButtons((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }
  function addButton(b: WaTemplateButton) {
    setButtons((bs) => [...bs, b])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('submit_for_approval', submitNow && canSubmit ? 'true' : 'false')
    formData.set('buttons', JSON.stringify(buttons))
    if (buttonError) {
      setError(buttonError)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createTemplate(formData)
      if (result.success && 'warning' in result && result.warning) {
        setError(result.warning)
      } else if (result.success) {
        router.push('/whatsapp/templates')
      } else {
        setError(result.error ?? 'Failed to create template')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name (API)</label>
          <input
            name="name"
            required
            placeholder="welcome_message"
            pattern="[a-z0-9_]+"
            title="Lowercase letters, numbers, and underscores only"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">Lowercase, underscores only</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            name="display_name"
            required
            placeholder="Welcome Message"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="marketing">Marketing</option>
            <option value="utility">Utility</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select
            name="language"
            defaultValue="en"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="en">English</option>
            <option value="en_US">English (US)</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Header (optional)</label>
        <input
          name="header_text"
          maxLength={60}
          placeholder="New launch in Jaipur"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <p className="text-xs text-gray-400 mt-1">Plain text, up to 60 characters, no variables</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message Body
          <span className="text-gray-400 font-normal ml-1">(use {`{{variable_name}}`} for variables)</span>
        </label>
        <textarea
          name="body"
          required
          rows={5}
          maxLength={1024}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{name}}, thank you for your interest in ANON INDIA properties!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
        {/^\s*\{\{/.test(body) || /\}\}\s*$/.test(body) ? (
          <p className="text-xs text-amber-600 mt-1">WhatsApp rejects a message that starts or ends with a variable — add text around it.</p>
        ) : null}
      </div>

      {variables.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sample values</label>
          <p className="text-xs text-gray-400 mb-2">
            WhatsApp&apos;s reviewers see these in place of each variable. Realistic samples get approved faster.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {variables.map((v) => (
              <label key={v} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full shrink-0">{`{{${v}}}`}</span>
                <input
                  name={`example_${v}`}
                  defaultValue={sampleValueFor(v)}
                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Footer (optional)</label>
        <input
          name="footer"
          maxLength={60}
          placeholder="ANON INDIA Real Estate"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Buttons (optional)</label>
        {buttons.length > 0 && (
          <div className="space-y-2 mb-2">
            {buttons.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-xs w-20 shrink-0 text-gray-500">
                  {b.type === 'URL' ? 'Website' : b.type === 'PHONE_NUMBER' ? 'Call' : 'Quick reply'}
                </span>
                <input
                  value={b.text}
                  maxLength={25}
                  placeholder="Button label"
                  onChange={(e) => setButton(i, { text: e.target.value })}
                  className={`${INPUT} w-40`}
                />
                {b.type === 'URL' && (
                  <input
                    value={b.url ?? ''}
                    placeholder="https://anonindia.com/projects"
                    onChange={(e) => setButton(i, { url: e.target.value })}
                    className={`${INPUT} flex-1 min-w-48`}
                  />
                )}
                {b.type === 'PHONE_NUMBER' && (
                  <input
                    value={b.phone_number ?? ''}
                    placeholder="+919876543210"
                    onChange={(e) => setButton(i, { phone_number: e.target.value })}
                    className={`${INPUT} flex-1 min-w-48`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => addButton({ type: 'QUICK_REPLY', text: '' })} className="text-xs px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">
            + Quick reply
          </button>
          <button type="button" onClick={() => addButton({ type: 'URL', text: 'View project', url: '' })} className="text-xs px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">
            + Website link
          </button>
          <button type="button" onClick={() => addButton({ type: 'PHONE_NUMBER', text: 'Call us', phone_number: '' })} className="text-xs px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">
            + Call button
          </button>
          {category === 'marketing' && !buttons.some((b) => b.text.trim().toLowerCase() === 'stop promotions') && (
            <button type="button" onClick={() => addButton({ type: 'QUICK_REPLY', text: 'Stop promotions' })} className="text-xs px-3 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800">
              + &ldquo;Stop promotions&rdquo;
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Up to 10 buttons: at most 2 website links and 1 call button. A &ldquo;Stop promotions&rdquo; button opts the customer out of marketing when tapped.
        </p>
        {buttonError && <p className="text-xs text-amber-600 mt-1">{buttonError}</p>}
      </div>

      {canSubmit ? (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} className="mt-0.5" />
          <span>
            Submit to WhatsApp for approval now
            <span className="block text-xs text-gray-400">Sent to Meta through AgencyX. Review usually takes minutes to a few hours; the verdict appears on the templates page as soon as WhatsApp gives it.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-amber-700">Saved as a draft. Connect AgencyX (AGENCYX_API_KEY) to submit templates for WhatsApp approval from here.</p>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-40"
        >
          {isPending ? 'Saving...' : submitNow && canSubmit ? 'Create & Submit for Approval' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
