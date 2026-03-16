'use client'

import { useState, useTransition, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Save, CheckCircle, Plus, Trash2, Paperclip, X, AlertTriangle } from 'lucide-react'
import { toWords } from 'number-to-words'
import { createInvoiceAction, sendInvoiceAction, getInvoicePreviewAction, type MismatchInfo } from '@/lib/actions/invoice'
import { markDocumentAsSentAction, deleteDocumentAction } from '@/lib/actions/proforma'
import { EmailChips } from '@/components/clients/client-form'
import SendDialog from '@/components/documents/send-dialog'
import { useOrgSettings } from '@/components/layout/org-settings-context'
import TemplateT2HTML from '@/components/documents/template-t2-html'
import TemplateT3HTML from '@/components/documents/template-t3-html'
import TemplateThumbnail from '@/components/documents/template-thumbnail'
import type { TemplateId, DocumentTemplateData } from '@/components/documents/template-types'

const VAT_RATE = 0.075

interface Campaign {
  title: string
  advertiser: string
  agency_name: string | null
  campaign_type: string
  agency_fee_pct: number
  currency: string
  tracker_id: string
  planned_contract_value: number | null
  start_date: string | null
  end_date: string | null
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function today(): string { return new Date().toISOString().split('T')[0] }

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function toNairaWords(amount: number): string {
  if (amount <= 0) return '—'
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase() + ' NAIRA'
  if (kobo > 0) result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  return result + ' ONLY'
}

interface LineItem { id: string; qty: string; description: string; unitPrice: string }

let _nextId = 4
function newItem(): LineItem { return { id: String(_nextId++), qty: '', description: '', unitPrice: '' } }

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white
        focus:outline-none focus:ring-2 focus:border-transparent transition
        disabled:bg-gray-50 disabled:text-gray-400 ${props.className ?? ''}`}
      style={{ '--tw-ring-color': '#0D9488', ...props.style } as React.CSSProperties}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white
        focus:outline-none focus:ring-2 focus:border-transparent transition resize-none
        disabled:bg-gray-50 ${props.className ?? ''}`}
      style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
    />
  )
}

export default function InvoiceForm({
  campaignId,
  campaign,
  clientEmail,
  clientCcEmails,
  clientName,
  clientAddress,
  clientCustomerId,
  clientPaymentTermsDays,
  poNumber,
  defaultTemplateId = '1',
  latestProforma,
}: {
  campaignId: string
  campaign: Campaign
  clientEmail?: string | null
  clientCcEmails?: string[]
  clientName?: string | null
  clientAddress?: string | null
  clientCustomerId?: string | null
  clientPaymentTermsDays?: number | null
  poNumber?: string | null
  defaultTemplateId?: string
  latestProforma?: { amount_before_vat: number; vat_amount: number; total_amount: number } | null
}) {
  const { primaryColor, logoUrl: orgLogoUrl, orgName } = useOrgSettings()
  const [templateId, setTemplateId] = useState<TemplateId>(
    (defaultTemplateId as TemplateId) ?? '1',
  )
  const [isPending, startTransition] = useTransition()
  const [savedDocId, setSavedDocId] = useState<string | null>(null)
  const [savedDocNumber, setSavedDocNumber] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stage, setStage] = useState<'editing' | 'draft_saved' | 'sending'>('editing')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Mismatch detection
  const [mismatch, setMismatch] = useState<MismatchInfo | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [pendingSendAfterMismatch, setPendingSendAfterMismatch] = useState(false)

  // MPO upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mpoFile, setMpoFile] = useState<File | null>(null)
  const [mpoFilePath, setMpoFilePath] = useState<string | null>(null)
  const [mpoUploading, setMpoUploading] = useState(false)
  const [mpoError, setMpoError] = useState<string | null>(null)

  // Recipient
  const [recipientName, setRecipientName] = useState(
    clientName ?? (campaign.agency_name && campaign.campaign_type === 'agency'
      ? campaign.agency_name
      : campaign.advertiser),
  )
  const [recipientEmail, setRecipientEmail] = useState(clientEmail ?? '')
  const [ccEmails, setCcEmails] = useState<string[]>(clientCcEmails ?? [])

  // Recognition period
  const [recognitionStart, setRecognitionStart] = useState(campaign.start_date ?? '')
  const [recognitionEnd, setRecognitionEnd] = useState(campaign.end_date ?? '')

  // Subject
  const [subject, setSubject] = useState(
    poNumber ? `${campaign.title} — PO: ${poNumber}` : campaign.title,
  )

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1', qty: '1', description: campaign.title,
      unitPrice: campaign.planned_contract_value != null ? String(campaign.planned_contract_value) : '',
    },
    { id: '2', qty: '', description: '', unitPrice: '' },
    { id: '3', qty: '', description: '', unitPrice: '' },
  ])

  const [issueDate, setIssueDate] = useState(today())
  const [paymentTermsDays, setPaymentTermsDays] = useState(clientPaymentTermsDays ?? 30)
  const [notes, setNotes] = useState('')

  const dueDate = issueDate ? addDays(issueDate, paymentTermsDays) : ''

  const parsedItems = useMemo(() =>
    lineItems.map((item) => {
      const qty = parseFloat(item.qty) || 0
      const price = parseFloat(item.unitPrice) || 0
      return { ...item, qtyNum: qty, priceNum: price, lineTotalNum: qty * price }
    }),
    [lineItems],
  )

  const subtotal = useMemo(() => parsedItems.reduce((s, i) => s + i.lineTotalNum, 0), [parsedItems])
  const vatAmount = useMemo(() => Math.round(subtotal * VAT_RATE * 100) / 100, [subtotal])
  const totalAmount = useMemo(() => Math.round((subtotal + vatAmount) * 100) / 100, [subtotal, vatAmount])
  const amountInWords = useMemo(() => toNairaWords(totalAmount), [totalAmount])

  const updateItem = useCallback(
    (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
      setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
    },
    [],
  )

  const addItem = useCallback(() => setLineItems((prev) => [...prev, newItem()]), [])
  const removeItem = useCallback((id: string) => setLineItems((prev) => prev.filter((item) => item.id !== id)), [])

  async function handleMpoUpload(file: File) {
    setMpoUploading(true)
    setMpoError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('campaignId', campaignId)
      const res = await fetch('/api/upload/mpo', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMpoError(json.error ?? 'Upload failed.')
      } else {
        setMpoFilePath(json.filePath as string)
        setMpoFile(file)
      }
    } catch {
      setMpoError('Upload failed. Please try again.')
    }
    setMpoUploading(false)
  }

  const canSend = recipientEmail.includes('@') && !!recognitionStart && !!recognitionEnd && subtotal > 0

  function buildSaveInput() {
    return {
      campaignId,
      recipientName,
      recipientEmail,
      ccEmails,
      recognitionStart,
      recognitionEnd,
      invoiceSubject: subject,
      lineItems: parsedItems
        .filter((i) => i.qtyNum > 0 || i.description || i.priceNum > 0)
        .map((i) => ({ qty: i.qtyNum, description: i.description, unit_price: i.priceNum, line_total: i.lineTotalNum })),
      issueDateOverride: issueDate,
      paymentTermsDays,
      notes,
      mpoFilePath,
      templateId,
    }
  }

  function handleSaveDraft(mismatchAcknowledged = false) {
    setSaveError(null)
    startTransition(async () => {
      const input = {
        ...buildSaveInput(),
        mismatchAcknowledged,
        mismatchOverrideReason: mismatchAcknowledged ? overrideReason : undefined,
      }
      const result = await createInvoiceAction(input)
      if (result.mismatch) {
        setMismatch(result.mismatch)
      } else if (result.error) {
        setSaveError(result.error)
      } else {
        setSavedDocId(result.docId!)
        setSavedDocNumber(result.docNumber ?? null)
        setStage('draft_saved')
        setMismatch(null)
      }
    })
  }

  function handleSaveAndSend(mismatchAcknowledged = false) {
    setSaveError(null)
    startTransition(async () => {
      let docId = savedDocId
      let docNumber = savedDocNumber
      if (!docId) {
        setStage('sending')
        const input = {
          ...buildSaveInput(),
          mismatchAcknowledged,
          mismatchOverrideReason: mismatchAcknowledged ? overrideReason : undefined,
        }
        const result = await createInvoiceAction(input)
        if (result.mismatch) {
          setMismatch(result.mismatch)
          setPendingSendAfterMismatch(true)
          setStage('editing')
          return
        }
        if (result.error) {
          setSaveError(result.error)
          setStage('editing')
          return
        }
        docId = result.docId!
        docNumber = result.docNumber ?? null
        setSavedDocId(docId)
        setSavedDocNumber(docNumber)
        setStage('draft_saved')
        setMismatch(null)
      }
      setDialogOpen(true)
    })
  }

  const pc = primaryColor

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaign
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
        <p className="text-sm text-gray-500 mt-1">{campaign.tracker_id} · {campaign.title}</p>
      </div>

      {stage === 'draft_saved' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          Draft saved as {savedDocNumber}. Review and send when ready.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Form ── */}
        <div className="space-y-5">

          {/* Recipient */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">Recipient</h2>
            <div>
              <Label>Recipient Name</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Advertiser or agency name" />
            </div>
            <div>
              <Label>Recipient Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="billing@client.com" />
            </div>
            <div>
              <Label>CC Emails <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
              <EmailChips value={ccEmails} onChange={setCcEmails} placeholder="Add CC email…" />
            </div>
          </div>

          {/* Recognition period */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">Recognition Period <span className="text-red-500">*</span></h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={recognitionStart} onChange={(e) => setRecognitionStart(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={recognitionEnd} onChange={(e) => setRecognitionEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Invoice Subject</h2>
            <Textarea rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Invoice subject line…" />
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left font-semibold text-gray-500 w-16">QTY</th>
                    <th className="pb-2 text-left font-semibold text-gray-500 pl-2">DESCRIPTION</th>
                    <th className="pb-2 text-left font-semibold text-gray-500 pl-2 w-28">UNIT PRICE</th>
                    <th className="pb-2 text-right font-semibold text-gray-500 w-24">LINE TOTAL</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => {
                    const qty = parseFloat(item.qty) || 0
                    const price = parseFloat(item.unitPrice) || 0
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2">
                          <input type="number" min="0" step="any" value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                            placeholder="1"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': pc } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input type="text" value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description…"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': pc } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input type="number" min="0" step="0.01" value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': pc } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 pl-2 text-right text-gray-700 tabular-nums">
                          {qty > 0 && price > 0 ? fmt(qty * price, campaign.currency) : '—'}
                        </td>
                        <td className="py-1.5 pl-1">
                          {lineItems.length > 1 && (
                            <button type="button" onClick={() => removeItem(item.id)}
                              className="p-1 rounded text-gray-300 hover:text-red-400 transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700
                transition min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>

            <div className="flex justify-end pt-1">
              <div className="space-y-1.5 text-sm w-64">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(subtotal, campaign.currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>VAT @ 7.5%</span>
                  <span className="tabular-nums">{fmt(vatAmount, campaign.currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(totalAmount, campaign.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">Invoice Details</h2>
            <div>
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <select
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm
                  text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': pc } as React.CSSProperties}
              >
                <option value={0}>Due on Receipt</option>
                <option value={15}>Net 15</option>
                <option value={30}>Net 30</option>
                <option value={45}>Net 45</option>
                <option value={60}>Net 60</option>
              </select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes for the client…" />
            </div>
          </div>

          {/* MPO / Supporting document upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Attach MPO / Supporting Document</h2>
            <p className="text-xs text-gray-400">
              Upload the Media Purchase Order or any supporting PDF. It will be included as an attachment when the invoice is emailed.
            </p>

            {mpoFile ? (
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <Paperclip className="h-4 w-4 text-teal-600 flex-shrink-0" />
                <span className="text-sm text-teal-800 font-medium flex-1 truncate">{mpoFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setMpoFile(null); setMpoFilePath(null) }}
                  className="text-teal-400 hover:text-red-500 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleMpoUpload(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mpoUploading}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg
                    border border-dashed border-gray-300 text-sm text-gray-500
                    hover:border-gray-400 hover:text-gray-700 transition disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" />
                  {mpoUploading ? 'Uploading…' : 'Attach MPO (PDF or Excel)'}
                </button>
              </div>
            )}
            {mpoError && <p className="text-xs text-red-600">{mpoError}</p>}
          </div>

          {/* Errors */}
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {saveError}
            </p>
          )}

          {/* Mismatch comparison table */}
          {mismatch && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Value mismatch with Proforma</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    The invoice values differ from the most recent proforma. Review the differences below.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-amber-200">
                      <th className="text-left py-1.5 font-semibold text-amber-900">Field</th>
                      <th className="text-right py-1.5 font-semibold text-amber-900">Proforma</th>
                      <th className="text-right py-1.5 font-semibold text-amber-900">Invoice</th>
                      <th className="text-right py-1.5 font-semibold text-amber-900">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Amount Before VAT', pf: mismatch.proforma.amount_before_vat, inv: mismatch.invoice.amount_before_vat },
                      { label: 'VAT Amount', pf: mismatch.proforma.vat_amount, inv: mismatch.invoice.vat_amount },
                      { label: 'Total Amount', pf: mismatch.proforma.total_amount, inv: mismatch.invoice.total_amount },
                    ].map(({ label, pf, inv }) => {
                      const diff = inv - pf
                      const hasDiff = Math.abs(diff) > 0.01
                      return (
                        <tr key={label} className={`border-b border-amber-100 ${hasDiff ? 'bg-amber-100/50' : ''}`}>
                          <td className="py-1.5 text-amber-900">{label}</td>
                          <td className="py-1.5 text-right tabular-nums text-amber-800">{fmt(pf, campaign.currency)}</td>
                          <td className="py-1.5 text-right tabular-nums text-amber-800">{fmt(inv, campaign.currency)}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${hasDiff ? 'text-red-600' : 'text-gray-400'}`}>
                            {hasDiff ? (diff > 0 ? '+' : '') + fmt(diff, campaign.currency) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Recalculate line items to match proforma amount_before_vat
                  const targetSubtotal = mismatch.proforma.amount_before_vat
                  setLineItems((prev) => {
                    const nonEmpty = prev.filter((i) => {
                      const qty = parseFloat(i.qty) || 0
                      const price = parseFloat(i.unitPrice) || 0
                      return qty > 0 && price > 0
                    })
                    if (nonEmpty.length === 1) {
                      const item = nonEmpty[0]
                      const qty = parseFloat(item.qty) || 1
                      return prev.map((i) =>
                        i.id === item.id
                          ? { ...i, unitPrice: String(Math.round((targetSubtotal / qty) * 100) / 100) }
                          : i,
                      )
                    } else if (nonEmpty.length > 1) {
                      const lastItem = nonEmpty[nonEmpty.length - 1]
                      const othersTotal = nonEmpty.slice(0, -1).reduce((s, i) => {
                        const q = parseFloat(i.qty) || 0
                        const p = parseFloat(i.unitPrice) || 0
                        return s + q * p
                      }, 0)
                      const lastQty = parseFloat(lastItem.qty) || 1
                      const newLastPrice = (targetSubtotal - othersTotal) / lastQty
                      return prev.map((i) =>
                        i.id === lastItem.id
                          ? { ...i, unitPrice: String(Math.round(newLastPrice * 100) / 100) }
                          : i,
                      )
                    }
                    return prev
                  })
                  setMismatch(null)
                }}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Update to Match Proforma
              </button>
              <div className="space-y-2 pt-1 border-t border-amber-200">
                <label className="block text-xs font-medium text-amber-900">
                  Override reason (required to proceed with mismatched values)
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  placeholder="Explain why the invoice values differ from the proforma…"
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs bg-white resize-none focus:outline-none focus:ring-2"
                />
                <button
                  type="button"
                  disabled={!overrideReason.trim() || isPending}
                  onClick={() => {
                    if (pendingSendAfterMismatch) {
                      setPendingSendAfterMismatch(false)
                      handleSaveAndSend(true)
                    } else {
                      handleSaveDraft(true)
                    }
                  }}
                  className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition disabled:opacity-50"
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleSaveDraft(false)}
              disabled={isPending || subtotal <= 0}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-semibold border border-gray-300 text-gray-700
                hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isPending && stage === 'editing' ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSaveAndSend(false)}
              disabled={isPending || !canSend}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-semibold text-white transition
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: canSend ? pc : '#9CA3AF' }}
              onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = '#0b857a' }}
              onMouseLeave={(e) => { if (canSend) e.currentTarget.style.background = canSend ? pc : '#9CA3AF' }}
            >
              <Send className="h-4 w-4" />
              {isPending && stage === 'sending' ? 'Sending…' : stage === 'draft_saved' ? 'Send Now' : 'Save & Send'}
            </button>
          </div>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Live Preview</h2>
            {/* Template selector */}
            <div className="flex gap-1.5">
              {(['1', '2', '3'] as TemplateId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplateId(id)}
                  title={id === '1' ? 'Classic' : id === '2' ? 'Minimal' : 'Corporate'}
                  className={`p-1.5 rounded-lg border transition-all ${
                    templateId === id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <TemplateThumbnail templateId={id} primaryColor={pc} active={templateId === id} />
                </button>
              ))}
            </div>
          </div>

          {/* Templates 2 & 3 */}
          {(templateId === '2' || templateId === '3') && (() => {
            const payTermsLabel = paymentTermsDays === 0
              ? 'Due on Receipt'
              : `Net ${paymentTermsDays}`
            const tData: DocumentTemplateData = {
              orgName,
              orgAddress: null,
              logoUrl: orgLogoUrl ?? null,
              primaryColor: pc,
              documentType: 'invoice',
              documentTitle: 'INVOICE',
              invoiceNumber: savedDocNumber ?? '',
              issueDate: issueDate ? fmtDate(issueDate) : '—',
              recipientName,
              recipientAddress: clientAddress ?? null,
              customerId: clientCustomerId ?? '—',
              invoiceSubject: subject,
              currency: campaign.currency,
              lineItems: parsedItems.map((i) => ({
                qty: i.qtyNum,
                description: i.description,
                unitPrice: i.priceNum,
                lineTotal: i.lineTotalNum,
              })),
              subtotal,
              vatAmount,
              totalAmount,
              notes: notes || null,
              amountInWords,
              dueDate: dueDate ? fmtDate(dueDate) : '—',
              paymentTerms: payTermsLabel,
              poNumber: poNumber ?? null,
              balanceDue: totalAmount,
            }
            return templateId === '2'
              ? <TemplateT2HTML data={tData} />
              : <TemplateT3HTML data={tData} />
          })()}

          {/* Template 1 — classic inline preview */}
          {templateId === '1' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-xs font-sans select-none">

            {/* ── Header ── */}
            <div className="px-8 pt-7 pb-3 flex justify-between items-start gap-4">
              <div>
                {orgLogoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={orgLogoUrl} alt={orgName} className="h-14 max-w-[150px] object-contain" />
                  : <span className="text-2xl font-extrabold leading-none" style={{ color: pc }}>{orgName}</span>
                }
              </div>
              <div className="text-right pt-1">
                <div className="text-xl font-extrabold leading-tight" style={{ color: '#1a1a4e' }}>TAX INVOICE</div>
              </div>
            </div>
            <hr className="mx-8 mb-5" style={{ borderColor: pc, borderTopWidth: 3 }} />

            {/* ── Meta: stacked DATE / INVOICE# / CUSTOMER ID | TO ── */}
            <div className="px-8 pb-5 flex justify-between gap-6">
              <div className="flex gap-7">
                {[
                  ['DATE', issueDate ? fmtDate(issueDate) : '—'],
                  ['INVOICE #', savedDocNumber ?? '(on save)'],
                  ['CUSTOMER ID', clientCustomerId ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="font-bold text-[9px] uppercase mb-1" style={{ color: pc }}>{label}</div>
                    <div className="font-bold text-gray-900 text-[11px]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <div className="font-bold text-[9px] uppercase mb-1" style={{ color: pc }}>TO</div>
                <div className="font-bold text-gray-900 text-[11px]">{recipientName || campaign.advertiser}</div>
                {clientAddress && (
                  <div className="text-gray-500 text-[10px] mt-1 whitespace-pre-line max-w-[180px]">{clientAddress}</div>
                )}
              </div>
            </div>

            {/* ── Subject ── */}
            <div className="px-8 pb-4">
              <div className="font-bold text-[9px] uppercase mb-1.5" style={{ color: pc }}>SUBJECT:</div>
              <div className="border px-3 py-2 text-[11px] text-gray-800" style={{ borderColor: pc }}>
                {subject || '—'}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="px-8 pb-3 overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: pc }}>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[8%]">QTY</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-left w-[47%]">DESCRIPTION</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[23%]">UNIT PRICE</th>
                    <th className="py-2 px-2 text-white font-bold uppercase text-right w-[22%]">LINE TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.filter((i) => i.qtyNum > 0 || i.description || i.priceNum > 0).map((item) => (
                    <tr key={item.id} className="border-b border-gray-200" style={{ height: 26 }}>
                      <td className="py-1.5 px-2 text-gray-700">{item.qty || ''}</td>
                      <td className="py-1.5 px-2 text-gray-800">{item.description || ''}</td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.priceNum > 0 ? fmt(item.priceNum, campaign.currency) : ''}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-800">
                        {item.lineTotalNum > 0 ? fmt(item.lineTotalNum, campaign.currency) : ''}
                      </td>
                    </tr>
                  ))}
                  {/* VAT row */}
                  <tr className="border-b border-gray-200" style={{ height: 26 }}>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-gray-800">Vat@ 7.5%</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2 text-right text-gray-800">
                      {vatAmount > 0 ? fmt(vatAmount, campaign.currency) : ''}
                    </td>
                  </tr>
                  {/* Empty rows */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-gray-200" style={{ height: 26 }}>
                      <td className="px-2"></td>
                      <td className="px-2"></td>
                      <td className="px-2"></td>
                      <td className="px-2"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── TOTAL ── */}
            <div className="px-8 pb-4 flex justify-end items-center gap-3">
              <span className="font-bold text-sm" style={{ color: pc }}>TOTAL</span>
              <div className="border-2 px-4 py-1.5 font-bold text-sm text-gray-900" style={{ borderColor: pc }}>
                {fmt(totalAmount, campaign.currency)}
              </div>
            </div>

            {/* ── Amount in words ── */}
            <div className="px-8 pb-5 flex gap-2 flex-wrap text-[10px]">
              <span className="font-bold shrink-0" style={{ color: pc }}>AMOUNT IN WORDS:</span>
              <span className="text-gray-800 leading-relaxed">{amountInWords}</span>
            </div>

            {/* ── Footer ── */}
            <div className="mx-8 mb-6 border-t border-gray-100 pt-4 space-y-2">
              <div className="text-center font-bold text-[11px]" style={{ color: pc }}>
                THANK YOU FOR YOUR BUSINESS
              </div>
              <div className="text-center text-[10px] text-gray-500">
                NOTE: All cheques should be in favor of {orgName}
              </div>
            </div>

          </div>
          )}
        </div>
      </div>

      {savedDocId && (
        <SendDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setStage('draft_saved') }}
          docId={savedDocId}
          campaignId={campaignId}
          documentType="invoice"
          documentNumber={savedDocNumber ?? 'INV-???'}
          campaignTitle={campaign.title}
          clientName={recipientName}
          defaultTo={recipientEmail}
          defaultCc={ccEmails}
          defaultRecipientName={recipientName}
          bankAccounts={[]}
          defaultBankAccountId={null}
          onSend={async (p) => {
            const r = await sendInvoiceAction(savedDocId, campaignId, p)
            return r ?? {}
          }}
          onGetPreview={async (rn, mb, bankAccountId) => {
            return await getInvoicePreviewAction(savedDocId, rn, mb, bankAccountId)
          }}
        />
      )}
    </div>
  )
}
