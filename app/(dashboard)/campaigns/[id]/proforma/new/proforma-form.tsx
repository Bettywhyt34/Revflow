'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Save, CheckCircle } from 'lucide-react'
import { createProformaAction, sendProformaAction, getProformaPreviewAction } from '@/lib/actions/proforma'
import { EmailChips } from '@/components/clients/client-form'
import SendDialog from '@/components/documents/send-dialog'

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
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Live proforma preview ──────────────────────────────────────────────────

interface PreviewProps {
  campaign: Campaign
  recipientName: string
  issueDate: string
  validUntil: string
  dueDate: string
  recognitionStart: string
  recognitionEnd: string
  amountBeforeVat: number
  includeAgencyFee: boolean
  agencyFeePct: number
  agencyFeeAmount: number
  vatAmount: number
  totalAmount: number
  notes: string
  docNumber: string
}

function ProformaPreview(p: PreviewProps) {
  const showAgencyFee = p.includeAgencyFee && p.agencyFeeAmount > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm font-sans">
      {/* Header */}
      <div
        className="px-8 py-6"
        style={{ background: 'linear-gradient(135deg,#0D9488 0%,#065F59 100%)' }}
      >
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-xl font-extrabold text-white tracking-tight">QVT MEDIA</div>
            <div className="text-xs text-teal-200 mt-0.5">Campaign Billing. Done Right.</div>
            <div className="text-xs text-teal-200 mt-1">Lagos, Nigeria · billing@revflowapp.com</div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-white">PROFORMA INVOICE</div>
            <div className="text-xs text-teal-100 mt-1 font-semibold">
              {p.docNumber || 'PROF-XXX'}
            </div>
            <div className="text-xs text-teal-200 mt-1">
              Date: {p.issueDate ? fmtDate(p.issueDate) : '—'}<br />
              Valid Until: {p.validUntil ? fmtDate(p.validUntil) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 space-y-5">
        {/* Bill To + Recognition Period */}
        <div className="flex justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bill To</div>
            <div className="font-bold text-gray-900">{p.recipientName || '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Recognition Period
            </div>
            <div className="text-sm font-semibold" style={{ color: '#0D9488' }}>
              {p.recognitionStart && p.recognitionEnd
                ? `${fmtDate(p.recognitionStart)} – ${fmtDate(p.recognitionEnd)}`
                : '— required —'}
            </div>
          </div>
        </div>

        {/* Campaign ref */}
        <div>
          <div className="text-xs text-gray-400 mb-0.5">RE: Ref {p.campaign.tracker_id}</div>
          <div className="font-bold text-gray-900 text-base">{p.campaign.title}</div>
        </div>

        {/* Line items */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="py-2 text-left text-gray-500 font-semibold uppercase tracking-wide w-6">#</th>
              <th className="py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Description</th>
              <th className="py-2 text-right text-gray-500 font-semibold uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 text-gray-500">1</td>
              <td className="py-3 text-gray-700">
                {p.campaign.title}
                {p.recognitionStart && p.recognitionEnd && (
                  <div className="text-gray-400 mt-0.5">
                    {fmtDate(p.recognitionStart)} – {fmtDate(p.recognitionEnd)}
                  </div>
                )}
              </td>
              <td className="py-3 text-right text-gray-800 font-medium">
                {fmt(p.amountBeforeVat, p.campaign.currency)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <table className="w-64 text-xs border-collapse">
            <tbody>
              <tr>
                <td className="py-1.5 text-gray-500">Subtotal</td>
                <td className="py-1.5 text-right text-gray-700">
                  {fmt(p.amountBeforeVat, p.campaign.currency)}
                </td>
              </tr>
              {showAgencyFee && (
                <tr>
                  <td className="py-1.5 text-gray-500">
                    Agency Commission ({p.agencyFeePct}%)
                  </td>
                  <td className="py-1.5 text-right text-gray-700">
                    {fmt(p.agencyFeeAmount, p.campaign.currency)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-1.5 text-gray-500">VAT @ 7.5%</td>
                <td className="py-1.5 text-right text-gray-700">
                  {fmt(p.vatAmount, p.campaign.currency)}
                </td>
              </tr>
              <tr className="border-t-2 border-teal-500">
                <td className="pt-2 font-bold text-gray-900">Total Due</td>
                <td className="pt-2 text-right font-bold text-gray-900">
                  {fmt(p.totalAmount, p.campaign.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment callout */}
        {p.dueDate && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 text-xs">
            <span className="font-semibold text-teal-800">Payment due by {fmtDate(p.dueDate)}</span>
            <span className="text-teal-600 ml-1">(30 days from invoice date)</span>
          </div>
        )}

        {p.notes && (
          <div className="bg-gray-50 border-l-2 border-teal-400 px-3 py-2 text-xs text-gray-600 rounded-r-lg">
            <span className="font-semibold">Notes:</span> {p.notes}
          </div>
        )}

        {/* Bank details */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Details</div>
          <div className="text-gray-500">Bank: <span className="text-gray-700 font-medium">To be provided by accounts</span></div>
          <div className="text-gray-500 mt-0.5">Account Name: <span className="text-gray-700 font-medium">QVT Media Limited</span></div>
        </div>

        <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
          This is a proforma invoice. Payment constitutes acceptance of the booking.
        </p>
      </div>
    </div>
  )
}

// ── Form field helpers ────────────────────────────────────────────────────

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
      style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
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

// ── Main form ─────────────────────────────────────────────────────────────

export default function ProformaForm({
  campaignId,
  campaign,
  clientEmail,
  clientCcEmails,
  clientName,
}: {
  campaignId: string
  campaign: Campaign
  clientEmail?: string | null
  clientCcEmails?: string[]
  clientName?: string | null
}) {
  const isAgency = campaign.campaign_type === 'agency'

  const [isPending, startTransition] = useTransition()
  const [savedDocId, setSavedDocId] = useState<string | null>(null)
  const [savedDocNumber, setSavedDocNumber] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [stage, setStage] = useState<'editing' | 'draft_saved' | 'sending'>('editing')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form fields
  const [recipientName, setRecipientName] = useState(
    clientName ?? (campaign.agency_name && isAgency ? campaign.agency_name : campaign.advertiser),
  )
  const [recipientEmail, setRecipientEmail] = useState(clientEmail ?? '')
  const [ccEmails, setCcEmails] = useState<string[]>(clientCcEmails ?? [])
  const [recognitionStart, setRecognitionStart] = useState(campaign.start_date ?? '')
  const [recognitionEnd, setRecognitionEnd] = useState(campaign.end_date ?? '')
  const [amountStr, setAmountStr] = useState(
    campaign.planned_contract_value != null
      ? String(campaign.planned_contract_value)
      : '',
  )
  const [includeAgencyFee, setIncludeAgencyFee] = useState(isAgency)
  const [agencyFeePctStr, setAgencyFeePctStr] = useState(String(campaign.agency_fee_pct ?? 10))
  const [issueDate, setIssueDate] = useState(today())
  const [paymentTermsDays] = useState(30)
  const [notes, setNotes] = useState('')

  // Derived
  const amountBeforeVat = parseFloat(amountStr) || 0
  const agencyFeePct = parseFloat(agencyFeePctStr) || 0
  const validUntil = issueDate ? addDays(issueDate, paymentTermsDays) : ''
  const dueDate = validUntil

  const { agencyFeeAmount, vatAmount, totalAmount } = useMemo(() => {
    const agencyFeeAmount = includeAgencyFee
      ? Math.round(amountBeforeVat * (agencyFeePct / 100) * 100) / 100
      : 0
    const vatBase = amountBeforeVat + agencyFeeAmount
    const vatAmount = Math.round(vatBase * VAT_RATE * 100) / 100
    const totalAmount = Math.round((vatBase + vatAmount) * 100) / 100
    return { agencyFeeAmount, vatAmount, totalAmount }
  }, [amountBeforeVat, includeAgencyFee, agencyFeePct])

  const canSend =
    recipientEmail.includes('@') &&
    recognitionStart &&
    recognitionEnd &&
    amountBeforeVat > 0

  function handleSaveDraft() {
    setSaveError(null)
    startTransition(async () => {
      const result = await createProformaAction({
        campaignId,
        recipientName,
        recipientEmail,
        ccEmails,
        recognitionStart,
        recognitionEnd,
        amountBeforeVat,
        includeAgencyFee,
        agencyFeePct,
        issueDateOverride: issueDate,
        paymentTermsDays,
        notes,
      })
      if (result.error) {
        setSaveError(result.error)
      } else {
        setSavedDocId(result.docId!)
        setSavedDocNumber(result.docNumber ?? null)
        setStage('draft_saved')
      }
    })
  }

  function handleSaveAndSend() {
    setSendError(null)
    startTransition(async () => {
      // If not yet saved as draft, save first
      let docId = savedDocId
      let docNumber = savedDocNumber
      if (!docId) {
        setStage('sending')
        const result = await createProformaAction({
          campaignId,
          recipientName,
          recipientEmail,
          ccEmails,
          recognitionStart,
          recognitionEnd,
          amountBeforeVat,
          includeAgencyFee,
          agencyFeePct,
          issueDateOverride: issueDate,
          paymentTermsDays,
          notes,
        })
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
        <h1 className="text-2xl font-bold text-gray-900">Create Proforma Invoice</h1>
        <p className="text-sm text-gray-500 mt-1">
          {campaign.tracker_id} · {campaign.title}
        </p>
      </div>

      {stage === 'draft_saved' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          Draft saved. Review the preview and send when ready.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Form ── */}
        <div className="space-y-5">
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
              <Label>
                Recipient Email{' '}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="billing@client.com"
              />
              <p className="text-xs text-gray-400 mt-1">
                The proforma will be sent to this address.
              </p>
            </div>

            <div>
              <Label>CC Emails <span className="text-gray-400 font-normal text-xs">(optional)</span></Label>
              <EmailChips value={ccEmails} onChange={setCcEmails} placeholder="Add CC email…" />
              <p className="text-xs text-gray-400 mt-1">
                Press Enter or comma to add. Pre-filled from client record.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Recognition Period{' '}
              <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-gray-400 -mt-3">
              Required for revenue recognition. Must be set before sending.
            </p>

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

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">Financials</h2>

            <div>
              <Label>Amount Before VAT ({campaign.currency})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {isAgency && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="includeAgencyFee"
                    type="checkbox"
                    checked={includeAgencyFee}
                    onChange={(e) => setIncludeAgencyFee(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    style={{ accentColor: '#0D9488' }}
                  />
                  <label htmlFor="includeAgencyFee" className="text-sm text-gray-700">
                    Include agency commission
                  </label>
                </div>
                {includeAgencyFee && (
                  <div>
                    <Label>Agency Fee %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={agencyFeePctStr}
                      onChange={(e) => setAgencyFeePctStr(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Calculated totals */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(amountBeforeVat, campaign.currency)}</span>
              </div>
              {includeAgencyFee && agencyFeeAmount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Agency Commission ({agencyFeePct}%)</span>
                  <span>{fmt(agencyFeeAmount, campaign.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>VAT @ 7.5%</span>
                <span>{fmt(vatAmount, campaign.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total Due</span>
                <span>{fmt(totalAmount, campaign.currency)}</span>
              </div>
            </div>
          </div>

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
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                readOnly
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">30 days from issue date</p>
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

          {/* Action buttons */}
          {(saveError || sendError) && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {saveError || sendError}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isPending || amountBeforeVat <= 0}
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
              style={{ background: canSend ? '#0D9488' : '#9CA3AF' }}
              onMouseEnter={(e) => {
                if (canSend) e.currentTarget.style.background = '#0b857a'
              }}
              onMouseLeave={(e) => {
                if (canSend) e.currentTarget.style.background = '#0D9488'
              }}
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
              To enable send: enter a valid recipient email, recognition period start & end, and amount &gt; 0.
            </p>
          )}
        </div>

        {/* ── Preview ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Live Preview
          </h2>
          <ProformaPreview
            campaign={campaign}
            recipientName={recipientName}
            issueDate={issueDate}
            validUntil={validUntil}
            dueDate={dueDate}
            recognitionStart={recognitionStart}
            recognitionEnd={recognitionEnd}
            amountBeforeVat={amountBeforeVat}
            includeAgencyFee={includeAgencyFee}
            agencyFeePct={agencyFeePct}
            agencyFeeAmount={agencyFeeAmount}
            vatAmount={vatAmount}
            totalAmount={totalAmount}
            notes={notes}
            docNumber="PROF-XXX"
          />
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
