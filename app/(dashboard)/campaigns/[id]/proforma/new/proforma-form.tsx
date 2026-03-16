'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Save, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { toWords } from 'number-to-words'
import { createProformaAction, updateProformaDraftAction, sendProformaAction, getProformaPreviewAction } from '@/lib/actions/proforma'
import { EmailChips } from '@/components/clients/client-form'
import SendDialog from '@/components/documents/send-dialog'
import { useOrgSettings } from '@/components/layout/org-settings-context'
import ProformaHTMLPreview from '@/components/documents/proforma-html-preview'
import TemplateT2HTML from '@/components/documents/template-t2-html'
import TemplateT3HTML from '@/components/documents/template-t3-html'
import TemplateThumbnail from '@/components/documents/template-thumbnail'
import type { TemplateId, DocumentTemplateData } from '@/components/documents/template-types'

const VAT_RATE = 0.075

// ── Helpers ────────────────────────────────────────────────────────────────

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
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function toNairaWords(amount: number): string {
  if (amount <= 0) return '—'
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase()
  result += ' NAIRA'
  if (kobo > 0) result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  return result + ' ONLY'
}

// ── Line item type ─────────────────────────────────────────────────────────

interface LineItem {
  id: string
  qty: string
  description: string
  unitPrice: string
}

let _nextId = 4
function newItem(): LineItem {
  return { id: String(_nextId++), qty: '', description: '', unitPrice: '' }
}

// ── Form field helpers ─────────────────────────────────────────────────────

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

// ── Initial doc type (for edit mode) ─────────────────────────────────────

export interface InitialProformaDoc {
  id: string
  document_number: string
  version: number
  recipient_name: string | null
  recipient_email: string | null
  cc_emails: string[]
  recognition_period_start: string | null
  recognition_period_end: string | null
  invoice_subject: string | null
  line_items: Array<{ qty: number; description: string; unit_price: number; line_total: number }>
  issue_date: string | null
  due_date: string | null
  notes: string | null
  template_id: string
}

function computeTermsDays(issueDate: string | null, dueDate: string | null): number {
  if (!issueDate || !dueDate) return 30
  return Math.max(0, Math.round((new Date(dueDate).getTime() - new Date(issueDate).getTime()) / 86400000))
}

// ── Main form ─────────────────────────────────────────────────────────────

export default function ProformaForm({
  campaignId,
  campaign,
  clientEmail,
  clientCcEmails,
  clientName,
  clientAddress,
  clientCustomerId,
  clientPaymentTermsDays,
  defaultTemplateId = '1',
  initialDoc,
  editDocId,
}: {
  campaignId: string
  campaign: Campaign
  clientEmail?: string | null
  clientCcEmails?: string[]
  clientName?: string | null
  clientAddress?: string | null
  clientCustomerId?: string | null
  clientPaymentTermsDays?: number | null
  defaultTemplateId?: string
  initialDoc?: InitialProformaDoc
  editDocId?: string
}) {
  const { primaryColor, logoUrl: orgLogoUrl, orgName } = useOrgSettings()
  const [templateId, setTemplateId] = useState<TemplateId>(
    (defaultTemplateId as TemplateId) ?? '1',
  )
  const [isPending, startTransition] = useTransition()
  const [savedDocId, setSavedDocId] = useState<string | null>(editDocId ?? null)
  const [savedDocNumber, setSavedDocNumber] = useState<string | null>(initialDoc?.document_number ?? null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [stage, setStage] = useState<'editing' | 'draft_saved' | 'sending'>('editing')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Recipient
  const [recipientName, setRecipientName] = useState(
    initialDoc?.recipient_name ??
    clientName ?? (campaign.agency_name && campaign.campaign_type === 'agency'
      ? campaign.agency_name
      : campaign.advertiser),
  )
  const [recipientEmail, setRecipientEmail] = useState(initialDoc?.recipient_email ?? clientEmail ?? '')
  const [ccEmails, setCcEmails] = useState<string[]>(initialDoc?.cc_emails ?? clientCcEmails ?? [])

  // Recognition period
  const [recognitionStart, setRecognitionStart] = useState(initialDoc?.recognition_period_start ?? campaign.start_date ?? '')
  const [recognitionEnd, setRecognitionEnd] = useState(initialDoc?.recognition_period_end ?? campaign.end_date ?? '')

  // Invoice subject
  const [subject, setSubject] = useState(initialDoc?.invoice_subject ?? campaign.title)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialDoc?.line_items && initialDoc.line_items.length > 0
      ? initialDoc.line_items.map((item, i) => ({
          id: String(i + 1),
          qty: String(item.qty),
          description: item.description,
          unitPrice: String(item.unit_price),
        }))
      : [
          {
            id: '1',
            qty: '1',
            description: campaign.title,
            unitPrice: campaign.planned_contract_value != null
              ? String(campaign.planned_contract_value)
              : '',
          },
          { id: '2', qty: '', description: '', unitPrice: '' },
          { id: '3', qty: '', description: '', unitPrice: '' },
        ],
  )

  // Issue date / payment terms
  const [issueDate, setIssueDate] = useState(initialDoc?.issue_date ?? today())
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    initialDoc ? computeTermsDays(initialDoc.issue_date, initialDoc.due_date) : (clientPaymentTermsDays ?? 30),
  )
  const [notes, setNotes] = useState(initialDoc?.notes ?? '')

  const dueDate = issueDate ? addDays(issueDate, paymentTermsDays) : ''

  // ── Derived calculations ──────────────────────────────────────────────

  const parsedItems = useMemo(() =>
    lineItems.map((item) => {
      const qty = parseFloat(item.qty) || 0
      const price = parseFloat(item.unitPrice) || 0
      return { ...item, qtyNum: qty, priceNum: price, lineTotalNum: qty * price }
    }),
    [lineItems],
  )

  const subtotal = useMemo(
    () => parsedItems.reduce((s, i) => s + i.lineTotalNum, 0),
    [parsedItems],
  )
  const vatAmount = useMemo(
    () => Math.round(subtotal * VAT_RATE * 100) / 100,
    [subtotal],
  )
  const totalAmount = useMemo(
    () => Math.round((subtotal + vatAmount) * 100) / 100,
    [subtotal, vatAmount],
  )
  const amountInWords = useMemo(() => toNairaWords(totalAmount), [totalAmount])

  // ── Line item handlers ────────────────────────────────────────────────

  const updateItem = useCallback(
    (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
      )
    },
    [],
  )

  const addItem = useCallback(() => setLineItems((prev) => [...prev, newItem()]), [])

  const removeItem = useCallback(
    (id: string) => setLineItems((prev) => prev.filter((item) => item.id !== id)),
    [],
  )

  // ── Validation ────────────────────────────────────────────────────────

  const canSend =
    recipientEmail.includes('@') &&
    !!recognitionStart &&
    !!recognitionEnd &&
    subtotal > 0

  // ── Save helpers ──────────────────────────────────────────────────────

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
        .map((i) => ({
          qty: i.qtyNum,
          description: i.description,
          unit_price: i.priceNum,
          line_total: i.lineTotalNum,
        })),
      issueDateOverride: issueDate,
      paymentTermsDays,
      notes,
      templateId,
    }
  }

  function handleSaveDraft() {
    setSaveError(null)
    startTransition(async () => {
      if (editDocId) {
        const result = await updateProformaDraftAction(editDocId, buildSaveInput())
        if (result.error) { setSaveError(result.error); return }
        setStage('draft_saved')
      } else {
        const result = await createProformaAction(buildSaveInput())
        if (result.error) { setSaveError(result.error); return }
        setSavedDocId(result.docId!)
        setSavedDocNumber(result.docNumber ?? null)
        setStage('draft_saved')
      }
    })
  }

  function handleSaveAndSend() {
    setSendError(null)
    startTransition(async () => {
      let docId = savedDocId
      let docNumber = savedDocNumber
      if (editDocId) {
        // Edit mode: save changes first, then open send dialog
        const result = await updateProformaDraftAction(editDocId, buildSaveInput())
        if (result.error) { setSendError(result.error); return }
        docId = editDocId
        setStage('draft_saved')
      } else if (!docId) {
        setStage('sending')
        const result = await createProformaAction(buildSaveInput())
        if (result.error) {
          setSendError(result.error)
          setStage('editing')
          return
        }
        docId = result.docId!
        docNumber = result.docNumber ?? null
        setSavedDocId(docId)
        setSavedDocNumber(docNumber)
        setStage('draft_saved')
      }
      setDialogOpen(true)
    })
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Back + title */}
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
        <h1 className="text-2xl font-bold text-gray-900">
          {editDocId ? `Edit Proforma Invoice${initialDoc?.version && initialDoc.version > 1 ? ` (v${initialDoc.version})` : ''}` : 'Create Proforma Invoice'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {campaign.tracker_id} · {campaign.title}
          {editDocId && savedDocNumber && <span className="text-gray-300 ml-1">· {savedDocNumber}</span>}
        </p>
      </div>

      {stage === 'draft_saved' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {editDocId
            ? 'Changes saved. Use Send Now to deliver the updated document.'
            : `Draft saved as ${savedDocNumber}. Review the preview and send when ready.`}
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
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Advertiser or agency name"
              />
            </div>

            <div>
              <Label>Recipient Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="billing@client.com"
              />
            </div>

            <div>
              <Label>CC Emails <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
              <EmailChips value={ccEmails} onChange={setCcEmails} placeholder="Add CC email…" />
            </div>
          </div>

          {/* Recognition period */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Recognition Period <span className="text-red-500">*</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={recognitionStart}
                  onChange={(e) => setRecognitionStart(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={recognitionEnd}
                  onChange={(e) => setRecognitionEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Invoice Subject</h2>
            <Textarea
              rows={2}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Invoice subject line…"
            />
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
                  {lineItems.map((item, idx) => {
                    const qty = parseFloat(item.qty) || 0
                    const price = parseFloat(item.unitPrice) || 0
                    const lineTotal = qty * price
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                            placeholder="1"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs
                              focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Description…"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs
                              focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full min-h-[36px] px-2 py-1 rounded border border-gray-200 text-xs
                              text-right focus:outline-none focus:ring-1 bg-white"
                            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                          />
                        </td>
                        <td className="py-1.5 pl-2 text-right text-gray-700 text-xs font-medium tabular-nums">
                          {lineTotal > 0 ? fmt(lineTotal, campaign.currency) : '—'}
                        </td>
                        <td className="py-1.5 pl-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-red-400 hover:text-red-600 transition rounded min-h-[36px] min-w-[36px]
                                flex items-center justify-center"
                              aria-label="Remove row"
                            >
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

            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg
                border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700
                transition min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>

            {/* Totals summary */}
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
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Payment Terms</Label>
              <select
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm
                  text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
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
              <Input
                type="date"
                value={dueDate}
                readOnly
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for the client…"
              />
            </div>
          </div>

          {/* Errors */}
          {(saveError || sendError) && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {saveError || sendError}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isPending || subtotal <= 0}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-semibold border border-gray-300 text-gray-700
                hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isPending && stage === 'editing' ? 'Saving…' : 'Save Draft'}
            </button>

            <button
              onClick={handleSaveAndSend}
              disabled={isPending || !canSend}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-semibold text-white transition
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: canSend ? primaryColor : '#9CA3AF' }}
              onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = '#0b857a' }}
              onMouseLeave={(e) => { if (canSend) e.currentTarget.style.background = primaryColor }}
            >
              <Send className="h-4 w-4" />
              {isPending && stage === 'sending'
                ? 'Sending…'
                : stage === 'draft_saved'
                  ? 'Send Now'
                  : 'Save & Send'}
            </button>
          </div>

          {!canSend && (
            <p className="text-xs text-gray-400">
              To enable send: enter a valid recipient email, recognition period, and at least one line item with an amount.
            </p>
          )}
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Live Preview
            </h2>
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
                  <TemplateThumbnail templateId={id} primaryColor={primaryColor} active={templateId === id} />
                </button>
              ))}
            </div>
          </div>
          {templateId === '1' && (
            <ProformaHTMLPreview
              orgName={orgName}
              orgLogoUrl={orgLogoUrl}
              primaryColor={primaryColor}
              invoiceNumber={savedDocNumber ?? ''}
              issueDate={issueDate ? fmtDate(issueDate) : '—'}
              recipientName={recipientName}
              recipientAddress={clientAddress ?? null}
              customerId={clientCustomerId ?? '—'}
              invoiceSubject={subject}
              currency={campaign.currency}
              lineItems={parsedItems.map((i) => ({
                qty: i.qtyNum,
                description: i.description,
                unitPrice: i.priceNum,
                lineTotal: i.lineTotalNum,
              }))}
              vatAmount={vatAmount}
              totalAmount={totalAmount}
              amountInWords={amountInWords}
              notes={notes}
            />
          )}
          {(templateId === '2' || templateId === '3') && (() => {
            const t2data: DocumentTemplateData = {
              orgName,
              orgAddress: null,
              logoUrl: orgLogoUrl ?? null,
              primaryColor,
              documentType: 'proforma',
              documentTitle: 'PROFORMA INVOICE',
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
            }
            return templateId === '2'
              ? <TemplateT2HTML data={t2data} />
              : <TemplateT3HTML data={t2data} />
          })()}
        </div>
      </div>

      {savedDocId && (
        <SendDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setStage('draft_saved') }}
          docId={savedDocId}
          campaignId={campaignId}
          documentType="proforma_invoice"
          documentNumber={savedDocNumber ?? 'PROF-???'}
          campaignTitle={campaign.title}
          clientName={clientName}
          defaultTo={recipientEmail}
          defaultCc={ccEmails}
          defaultRecipientName={recipientName}
          onSend={async (p) => {
            const r = await sendProformaAction(savedDocId, campaignId, p)
            return r ?? {}
          }}
          onGetPreview={async (rn, mb) => {
            return await getProformaPreviewAction(savedDocId, rn, mb)
          }}
        />
      )}
    </div>
  )
}
