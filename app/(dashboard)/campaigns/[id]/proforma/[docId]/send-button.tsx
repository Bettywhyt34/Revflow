'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { sendProformaAction, getProformaPreviewAction } from '@/lib/actions/proforma'
import SendDialog from '@/components/documents/send-dialog'

export default function SendDocumentButton({
  docId,
  campaignId,
  isSent,
  documentNumber,
  documentType,
  campaignTitle,
  clientName,
  recipientEmail,
  recipientName,
  ccEmails,
}: {
  docId: string
  campaignId: string
  isSent: boolean
  documentNumber: string
  documentType: string
  campaignTitle: string
  clientName?: string | null
  recipientEmail: string | null
  recipientName: string | null
  ccEmails: string[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        disabled={!recipientEmail}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
          rounded-lg text-sm font-semibold text-white transition
          disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#0D9488' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
      >
        <Send className="h-4 w-4" />
        {isSent ? 'Resend' : 'Send Now'}
      </button>

      <SendDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        docId={docId}
        campaignId={campaignId}
        documentType={documentType}
        documentNumber={documentNumber}
        campaignTitle={campaignTitle}
        clientName={clientName}
        defaultTo={recipientEmail ?? ''}
        defaultCc={ccEmails}
        defaultRecipientName={recipientName ?? ''}
        onSend={async (p) => {
          const r = await sendProformaAction(docId, campaignId, p)
          return r ?? {}
        }}
        onGetPreview={async (rn, mb) => {
          return await getProformaPreviewAction(docId, rn, mb)
        }}
      />
    </>
  )
}
