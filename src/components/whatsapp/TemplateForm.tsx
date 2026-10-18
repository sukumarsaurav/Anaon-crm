'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTemplate } from '@/lib/whatsapp/actions'
import { namedVariables, sampleValueFor } from '@/lib/whatsapp/template-render'

export default function TemplateForm({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')

  // Extract variables from body in real-time
  const variables = namedVariables(body)
  const [submitNow, setSubmitNow] = useState(canSubmit)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('submit_for_approval', submitNow && canSubmit ? 'true' : 'false')
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

      {canSubmit ? (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} className="mt-0.5" />
          <span>
            Submit to WhatsApp for approval now
            <span className="block text-xs text-gray-400">Sent to Meta through AgencyX. Review usually takes minutes to a few hours; use “Sync status” on the templates page to see the result.</span>
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
