'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, RefreshCw } from 'lucide-react'

declare global {
  interface Window { Razorpay?: any }
}

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PayNowButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    setStatus(null)

    const ok = await loadCheckoutScript()
    if (!ok || !window.Razorpay) {
      setLoading(false)
      setError('Could not load the payment gateway. Check your connection.')
      return
    }

    const res = await fetch('/api/portal/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? 'Could not start payment.')
      return
    }

    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      prefill: data.prefill,
      theme: { color: '#1e293b' },
      handler: () => {
        // Capture confirmation is async via webhook — poll the page state.
        setStatus('Payment received — confirming...')
        setTimeout(() => router.refresh(), 3500)
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    })
    rzp.on('payment.failed', (resp: any) => {
      setLoading(false)
      setError(resp?.error?.description ?? 'Payment failed. Please try again.')
    })
    rzp.open()
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {loading
          ? <><RefreshCw size={13} className="animate-spin" /> Opening...</>
          : <><CreditCard size={13} /> Pay Now</>}
      </button>
      {status && <p className="text-xs text-green-600 mt-1.5">{status}</p>}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}
