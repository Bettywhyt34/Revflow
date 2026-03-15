'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { X, Lock, Paperclip, Bold, Italic, List } from 'lucide-react'
import { EmailChips } from '@/components/clients/client-form'
import type { SendDocumentParams } from '@/lib/actions/send-document'
import type { OrgBankAccount } from '@/types'

const DOC_TYPE_LABELS: Record<string, string> = {
  proforma_invoice: 'Proforma Invoice',
  invoice: 'Invoice',
  credit_note: 'Credit Note',
}

interface SendDialogProps {
  open: boolean
  onClose: () => void
  docId: string
  documentType: string
  documentNumber: string
  campaignId: string
  campaignTitle: string
  clientName?: string | null
  defaultTo: string
  defaultCc: string[]
  defaultRecipientName: string
  bankAccounts?: OrgBankAccount[]
  defaultBankAccountId?: string | null
  onSend: (params: SendDocumentParams) => Promise<{ error?: string }>
  onGetPreview?: (recipientName: string, messageBody: string, bankAccountId?: string) => Promise<{ html?: string; error?: string }>
}

function buildDefaultBody(
  recipientName: string,
  docTypeLabel: string,
  docNumber: string,
  campaignTitle: string,
): string {
  return `Dear ${recipientName},\n\nPlease find your ${docTypeLabel} ${docNumber} for "${campaignTitle}" enclosed below.\n\nKindly review the details and feel free to reach out if you have any questions.\n\nWe look forward to receiving your purchase order at your earliest convenience.\n\nWarm regards,\nQVT Media Billing Team`
}

export default function SendDialog({
  open,
  onClose,
  docId,
  documentType,
  documentNumber,
  campaignId,
  campaignTitle,
  clientName,
  defaultTo,
  defaultCc,
  defaultRecipientName,
  bankAccounts = [],
  defaultBankAccountId,
  onSend,
  onGetPreview,
}: SendDialogProps) {
  const docTypeLabel = DOC_TYPE_LABELS[documentType] ?? documentType

  const [sentTo, setSentTo] = useState(defaultTo)
  const [ccEmails, setCcEmails] = useState<string[]>(defaultCc)
  const [bccEmails, setBccEmails] = useState<string[]>([])
  const [subject, setSubject] = useState(
    `${docTypeLabel} ${documentNumber} – ${clientName ?? ''} – ${campaignTitle}`,
  )
  const [recipientName, setRecipientName] = useState(defaultRecipientName)
  const [bankAccountId, setBankAccountId] = useState(defaultBankAccountId ?? '')
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
  const [tab, setTab] = useState<'compose' | 'preview'>('compose')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const bodyRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Default message body
  const defaultBody = buildDefaultBody(defaultRecipientName, docTypeLabel, documentNumber, campaignTitle)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSentTo(defaultTo)
      setCcEmails(defaultCc)
      setBccEmails([])
      setSubject(`${docTypeLabel} ${documentNumber} – ${clientName ?? ''} – ${campaignTitle}`)
      setRecipientName(defaultRecipientName)
      setBankAccountId(defaultBankAccountId ?? '')
      setAttachments([])
      setTab('compose')
      setPreviewHtml(null)
      setPreviewLoaded(false)
      setPreviewError(null)
      setSendError(null)
      if (bodyRef.current) {
        bodyRef.current.innerText = buildDefaultBody(defaultRecipientName, docTypeLabel, documentNumber, campaignTitle)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // When recipientName changes, update greeting in body only if it still has default text
  useEffect(() => {
    if (bodyRef.current) {
      const current = bodyRef.current.innerText
      if (current.startsWith('Dear ')) {
        const newBody = buildDefaultBody(recipientName, docTypeLabel, documentNumber, campaignTitle)
        bodyRef.current.innerText = newBody
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientName])

  if (!open) return null

  function getMessageBody(): string {
    return bodyRef.current?.innerHTML ?? ''
  }

  function execFormat(cmd: string) {
    document.execCommand(cmd, false)
    bodyRef.current?.focus()
  }

  async function handlePreview() {
    if (previewLoaded) {
      setTab('preview')
      return
    }
    if (!onGetPreview) {
      setTab('preview')
      return
    }
    setPreviewError(null)
    setTab('preview')
    const result = await onGetPreview(recipientName, getMessageBody(), bankAccountId || undefined)
    if (result.error) {
      setPreviewError(result.error)
    } else {
      setPreviewHtml(result.html ?? null)
      setPreviewLoaded(true)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/campaigns/${campaignId}/upload-doc`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { url: string; name: string }
      setAttachments((prev) => [...prev, { name: data.name ?? file.name, url: data.url }])
    } catch {
      setSendError('Failed to upload attachment.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleSend() {
    setSendError(null)
    startTransition(async () => {
      const result = await onSend({
        sentTo,
        recipientName,
        ccEmails,
        bccEmails,
        subject,
        messageBody: getMessageBody(),
        attachments,
        bankAccountId: bankAccountId || null,
      })
      if (result?.error) {
        setSendError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Send {docTypeLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{documentNumber} · {campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setTab('compose')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === 'compose'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Compose
          </button>
          <button
            onClick={handlePreview}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === 'preview'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Preview
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'compose' ? (
            <div className="px-6 py-5 space-y-4">
              {/* To */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
                <input
                  type="email"
                  value={sentTo}
                  onChange={(e) => setSentTo(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  placeholder="recipient@example.com"
                />
              </div>

              {/* Recipient Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Recipient Name
                  <span className="ml-1 text-gray-400 font-normal normal-case">(used in email greeting)</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  placeholder="Contact or company name"
                />
              </div>

              {/* CC */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CC</label>
                <EmailChips value={ccEmails} onChange={setCcEmails} placeholder="Add CC email…" />
              </div>

              {/* BCC */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">BCC</label>
                <EmailChips value={bccEmails} onChange={setBccEmails} placeholder="Add BCC email…" />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />
              </div>

              {/* Bank Account */}
              {bankAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Payment Bank Account
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => {
                      setBankAccountId(e.target.value)
                      setPreviewLoaded(false)
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                  >
                    <option value="">— Use default —</option>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label || a.bank_name} · {a.account_number.slice(-4)} · {a.currency}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message body */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</label>
                {/* Toolbar */}
                <div className="flex items-center gap-1 px-2 py-1.5 border border-b-0 border-gray-200 rounded-t-lg bg-gray-50">
                  <button
                    type="button"
                    onClick={() => execFormat('bold')}
                    title="Bold"
                    className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-200 transition text-gray-600"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execFormat('italic')}
                    title="Italic"
                    className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-200 transition text-gray-600"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => execFormat('insertUnorderedList')}
                    title="Bullet list"
                    className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-200 transition text-gray-600"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="w-full min-h-[200px] px-3 py-2.5 rounded-b-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition whitespace-pre-wrap"
                  style={{ lineHeight: '1.6' }}
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</label>

                {/* Non-removable: the proforma itself */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600 mb-2">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{documentNumber} (embedded in email)</span>
                  <Lock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                </div>

                {/* Extra attachments */}
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-100 text-sm text-gray-700 mb-2">
                    <Paperclip className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-teal-200 transition text-teal-600"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-900 font-medium disabled:opacity-50 transition"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Add attachment'}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5">
              {previewError ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {previewError}
                </p>
              ) : previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  className="w-full h-[500px] rounded-lg border border-gray-200"
                  title="Email preview"
                />
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                  {onGetPreview ? 'Loading preview…' : 'Preview not available.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex flex-col gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {sendError && (
            <p className="text-sm text-red-600">{sendError}</p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !sentTo.includes('@')}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0D9488' }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#0b857a' }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = '#0D9488' }}
            >
              {isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
