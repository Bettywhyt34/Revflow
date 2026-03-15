'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CheckCircle, Trash2 } from 'lucide-react'
import { sendInvoiceAction, getInvoicePreviewAction } from '@/lib/actions/invoice'
import { markDocumentAsSentAction, deleteDocumentAction } from '@/lib/actions/proforma'
import SendDialog from '@/components/documents/send-dialog'
import type { OrgBankAccount } from '@/types'

export default function InvoiceSendButton({
  docId,
  campaignId,
  isSent,
  isDraft,
  documentNumber,
  documentType,
  campaignTitle,
  clientName,
  recipientEmail,
  recipientName,
  ccEmails,
  bankAccounts = [],
  clientPreferredBankAccountId,
}: {
  docId: string
  campaignId: string
  isSent: boolean
  isDraft: boolean
  documentNumber: string
  documentType: string
  campaignTitle: string
  clientName?: string | null
  recipientEmail: string | null
  recipientName: string | null
  ccEmails: string[]
  bankAccounts?: OrgBankAccount[]
  clientPreferredBankAccountId?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showMarkConfirm, setShowMarkConfirm] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleMarkAsSent() {
    setMarkError(null)
    startTransition(async () => {
      const result = await markDocumentAsSentAction(docId, campaignId)
      if (result.error) { setMarkError(result.error) }
      else { setShowMarkConfirm(false); router.refresh() }
    })
  }

  function handleDelete() {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteDocumentAction(docId, campaignId)
      if (result.error) { setDeleteError(result.error) }
      else { router.push(`/campaigns/${campaignId}`) }
    })
  }

  return (
    <>
      {showMarkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="text-sm font-semibold text-gray-900">Mark invoice as sent without emailing?</p>
            <p className="text-sm text-gray-500">
              <span className="font-medium">{documentNumber}</span> will be marked as sent without an email.
              This cannot be undone.
            </p>
            {markError && <p className="text-xs text-red-600">{markError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowMarkConfirm(false)} disabled={isPending}
                className="flex-1 min-h-[44px] rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleMarkAsSent} disabled={isPending}
                className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition disabled:opacity-50">
                {isPending ? 'Marking…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="text-sm font-semibold text-gray-900">Delete this draft invoice?</p>
            <p className="text-sm text-gray-500">
              <span className="font-medium">{documentNumber}</span> will be permanently deleted. This cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isPending}
                className="flex-1 min-h-[44px] rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isPending}
                className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                {isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDraft && (
        <button onClick={() => setShowMarkConfirm(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
            rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
          <CheckCircle className="h-4 w-4" />
          Mark as Sent
        </button>
      )}

      <button onClick={() => setDialogOpen(true)} disabled={!recipientEmail}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
          rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#0D9488' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
      >
        <Send className="h-4 w-4" />
        {isSent ? 'Resend' : 'Send Now'}
      </button>

      {isDraft && (
        <button onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
            rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition">
          <Trash2 className="h-4 w-4" />
          Delete Draft
        </button>
      )}

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
        bankAccounts={bankAccounts}
        defaultBankAccountId={clientPreferredBankAccountId}
        onSend={async (p) => {
          const r = await sendInvoiceAction(docId, campaignId, p)
          return r ?? {}
        }}
        onGetPreview={async (rn, mb, bankAccountId) => {
          return await getInvoicePreviewAction(docId, rn, mb, bankAccountId)
        }}
      />
    </>
  )
}
