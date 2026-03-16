'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Edit2, Copy, AlertCircle, Loader2 } from 'lucide-react'
import { createVersionAction, voidDocumentAction } from '@/lib/actions/documents'
import { markDocumentAsSentAction, deleteDocumentAction } from '@/lib/actions/proforma'
import type { UserRole, OrgBankAccount } from '@/types'
import InvoiceSendButton from './send-button'
import CloneDocumentModal from '../../clone-document-modal'
import type { CloneableDoc } from '../../clone-document-modal'

interface InvoiceDocActionsProps {
  docId: string
  campaignId: string
  docType: string
  docStatus: string
  documentNumber: string
  docVersion: number
  role: UserRole
  canSend: boolean
  canEdit: boolean
  isDraft: boolean
  isSent: boolean
  recipientEmail: string | null
  recipientName: string | null
  ccEmails: string[]
  bankAccounts: OrgBankAccount[]
  clientPreferredBankAccountId: string | null
  campaignTitle: string
  clientName: string
  pdfHref: string
}

export default function InvoiceDocActions({
  docId,
  campaignId,
  docType,
  docStatus,
  documentNumber,
  docVersion,
  role,
  canSend,
  canEdit,
  isDraft,
  isSent,
  recipientEmail,
  recipientName,
  ccEmails,
  bankAccounts,
  clientPreferredBankAccountId,
  campaignTitle,
  clientName,
  pdfHref,
}: InvoiceDocActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showVersionConfirm, setShowVersionConfirm] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [showClone, setShowClone] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)

  const isSuperseded = docStatus === 'superseded'
  const isVoid = docStatus === 'void'
  const isCurrent = docStatus === 'current'
  const isOutdated = docStatus === 'outdated'
  const isReadOnly = isSuperseded || isVoid
  const needsVersion = (isCurrent || isOutdated) && canEdit

  function handleCreateVersion() {
    setEditError(null)
    startTransition(async () => {
      const res = await createVersionAction(docId, editReason)
      if (res.error) { setEditError(res.error); return }
      const { newDocId, type, campaignId: cId } = res
      if (type === 'invoice') {
        router.push(`/campaigns/${cId}/invoice/${newDocId}/edit`)
      } else {
        router.push(`/campaigns/${cId}`)
      }
    })
  }

  function handleVoidConfirm() {
    setVoidError(null)
    startTransition(async () => {
      const res = await voidDocumentAction(docId, voidReason)
      if (res.error) { setVoidError(res.error); return }
      router.push(`/campaigns/${campaignId}`)
    })
  }

  function handleMarkAsSent() {
    startTransition(async () => {
      await markDocumentAsSentAction(docId, campaignId)
      router.refresh()
    })
  }

  function handleDeleteDraft() {
    startTransition(async () => {
      await deleteDocumentAction(docId, campaignId)
      router.push(`/campaigns/${campaignId}`)
    })
  }

  const canClone = canEdit && (docType === 'proforma_invoice' || docType === 'invoice')

  return (
    <>
      {/* Version creation confirmation */}
      {showVersionConfirm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800">
              This document has been sent. Editing will create version {docVersion + 1} as a new draft.
              The current version will be marked SUPERSEDED.
            </p>
          </div>
          <input
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Reason for revision (optional)…"
            className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none bg-white"
          />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCreateVersion}
              disabled={isPending}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ background: '#0D9488' }}
            >
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : 'Proceed'}
            </button>
            <button onClick={() => setShowVersionConfirm(false)} className="min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Void confirmation */}
      {showVoid && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Void this document?</p>
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={2}
            placeholder="Reason for voiding (required)…"
            className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm resize-none focus:outline-none bg-white"
          />
          {voidError && <p className="text-sm text-red-600">{voidError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleVoidConfirm}
              disabled={!voidReason.trim() || isPending}
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
            >
              Confirm Void
            </button>
            <button onClick={() => setShowVoid(false)} className="min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main action bar */}
      <div className="flex justify-end gap-3 flex-wrap">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
        >
          Back
        </Link>

        <a
          href={pdfHref}
          download={`invoice-${documentNumber}.pdf`}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>

        {canClone && (
          <button
            onClick={() => setShowClone(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-purple-200 text-purple-700 hover:bg-purple-50 transition"
          >
            <Copy className="h-4 w-4" />
            Clone
          </button>
        )}

        {!isReadOnly && canEdit && (
          <>
            {isDraft && (
              <>
                <Link
                  href={`/campaigns/${campaignId}/invoice/${docId}/edit`}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Link>
                {!isSent && canSend && (
                  <button
                    onClick={handleMarkAsSent}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-green-200 text-green-700 hover:bg-green-50 transition disabled:opacity-50"
                  >
                    Mark as Sent
                  </button>
                )}
                {role === 'admin' && (
                  <button
                    onClick={handleDeleteDraft}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </>
            )}

            {needsVersion && !showVersionConfirm && (
              <button
                onClick={() => setShowVersionConfirm(true)}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
              >
                <Edit2 className="h-4 w-4" />
                Edit (new version)
              </button>
            )}

            {role === 'admin' && !isReadOnly && (
              <button
                onClick={() => setShowVoid(true)}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition"
              >
                Void
              </button>
            )}
          </>
        )}

        {isDraft && canSend && (
          <InvoiceSendButton
            docId={docId}
            campaignId={campaignId}
            isSent={isSent}
            isDraft={isDraft}
            documentNumber={documentNumber}
            documentType={docType}
            campaignTitle={campaignTitle}
            clientName={clientName}
            recipientEmail={recipientEmail}
            recipientName={recipientName}
            ccEmails={ccEmails}
            bankAccounts={bankAccounts}
            clientPreferredBankAccountId={clientPreferredBankAccountId}
          />
        )}
      </div>

      {showClone && (
        <CloneDocumentModal
          doc={{ id: docId, type: docType, status: docStatus, document_number: documentNumber, version: docVersion } satisfies CloneableDoc}
          campaignId={campaignId}
          onClose={() => setShowClone(false)}
        />
      )}
    </>
  )
}
