'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendProformaAction } from '@/lib/actions/proforma'

export default function SendProformaButton({
  docId,
  campaignId,
  isSent,
  recipientEmail,
}: {
  docId: string
  campaignId: string
  isSent: boolean
  recipientEmail: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSend() {
    setError(null)
    startTransition(async () => {
      const result = await sendProformaAction(docId, campaignId)
      if (result?.error) setError(result.error)
      // On success, server action redirects
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleSend}
        disabled={isPending || !recipientEmail}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
          rounded-lg text-sm font-semibold text-white transition
          disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#0D9488' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
      >
        <Send className="h-4 w-4" />
        {isPending ? 'Sending…' : isSent ? 'Resend' : 'Send Now'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
