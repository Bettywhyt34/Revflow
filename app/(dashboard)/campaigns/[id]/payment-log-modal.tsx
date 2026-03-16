'use client'

import { useState, useTransition, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import { logPaymentAction } from '@/lib/actions/payments'

const WHT_TYPE_RATES: Record<string, number> = {
  agency_fee: 5,
  general_services: 2,
  supply_goods: 2,
  rent: 10,
  dividend: 10,
  exempt: 0,
  custom: 0,
}

const WHT_TYPE_LABELS: Record<string, string> = {
  agency_fee: 'Agency Fee / Consultancy (5%)',
  general_services: 'General Services / Media Buying (2%)',
  supply_goods: 'Supply of Goods (2%)',
  rent: 'Rent (10%)',
  dividend: 'Dividend / Interest / Royalty (10%)',
  exempt: 'Exempt (0%)',
  custom: 'Custom Rate',
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 ' +
  'bg-white focus:outline-none focus:ring-2 focus:border-transparent transition ' +
  'disabled:bg-gray-50 disabled:text-gray-400'

export interface InvoiceOption {
  id: string
  document_number: string
  total_amount: number | null
  amount_before_vat: number | null
  outstanding: number | null
}

export default function PaymentLogModal({
  open,
  onClose,
  onSuccess,
  campaignId,
  trackerID,
  campaignTitle,
  currency,
  currentInvoices,
  balanceOutstanding,
  clientWhtApplicable,
  clientWhtType,
  clientWhtRate,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  campaignId: string
  trackerID: string
  campaignTitle: string
  currency: string
  currentInvoices: InvoiceOption[]
  balanceOutstanding: number | null
  clientWhtApplicable: boolean
  clientWhtType: string
  clientWhtRate: number
}) {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Step 1 fields
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [paymentDate, setPaymentDate] = useState(today())
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cheque' | 'cash' | 'other'>('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // Step 2 fields (WHT)
  const [whtApplicable, setWhtApplicable] = useState(clientWhtApplicable)
  const [whtType, setWhtType] = useState(clientWhtType)
  const [whtRatePct, setWhtRatePct] = useState(clientWhtRate * 100)
  const [whtAmountStr, setWhtAmountStr] = useState('')
  const [cashReceivedStr, setCashReceivedStr] = useState('')
  const [whtCertNumber, setWhtCertNumber] = useState('')
  const [whtCreditNoteNumber, setWhtCreditNoteNumber] = useState('')

  // Overpayment confirmation
  const [overpaymentInfo, setOverpaymentInfo] = useState<{ excess: number } | null>(null)

  const selectedInvoice = currentInvoices.find((inv) => inv.id === selectedInvoiceId) ?? null
  const invoiceTotal = selectedInvoice?.total_amount ?? 0
  const invoiceSubtotal = selectedInvoice?.amount_before_vat ?? invoiceTotal

  // Auto-calc WHT when type or invoice changes
  useEffect(() => {
    if (!whtApplicable) return
    if (whtType !== 'custom') {
      const rate = WHT_TYPE_RATES[whtType] ?? 0
      setWhtRatePct(rate)
      const whtAmt = (invoiceSubtotal * rate) / 100
      setWhtAmountStr(whtAmt > 0 ? whtAmt.toFixed(2) : '')
      setCashReceivedStr(whtAmt > 0 ? (invoiceTotal - whtAmt).toFixed(2) : invoiceTotal > 0 ? invoiceTotal.toFixed(2) : '')
    }
  }, [whtType, invoiceSubtotal, invoiceTotal, whtApplicable])

  // When whtAmountStr changes manually, update cash received
  function handleWhtAmountChange(val: string) {
    setWhtAmountStr(val)
    const whtAmt = parseFloat(val) || 0
    setCashReceivedStr((invoiceTotal - whtAmt).toFixed(2))
  }

  const whtAmount = parseFloat(whtAmountStr) || 0
  const cashReceived = parseFloat(cashReceivedStr) || 0
  const totalSettledCalc = cashReceived + whtAmount

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1)
      setError(null)
      setSelectedInvoiceId(currentInvoices[0]?.id ?? '')
      setPaymentDate(today())
      setPaymentMethod('bank_transfer')
      setReference('')
      setNotes('')
      setWhtApplicable(clientWhtApplicable)
      setWhtType(clientWhtType)
      setWhtRatePct(clientWhtRate * 100)
      setWhtAmountStr('')
      setCashReceivedStr('')
      setWhtCertNumber('')
      setWhtCreditNoteNumber('')
      setOverpaymentInfo(null)
    }
  }, [open, clientWhtApplicable, clientWhtType, clientWhtRate, currentInvoices])

  function goToStep2() {
    if (!paymentDate) { setError('Payment date is required.'); return }
    if (cashReceivedStr === '' && whtAmountStr === '' && currentInvoices.length === 0) {
      setError('Please select an invoice.')
      return
    }
    setError(null)
    // If client WHT is not applicable and user didn't toggle it on, skip to step 3
    if (!clientWhtApplicable && !whtApplicable) {
      // Pre-fill cash = invoice total
      setCashReceivedStr(invoiceTotal > 0 ? invoiceTotal.toFixed(2) : '')
      setStep(3)
    } else {
      setStep(2)
    }
  }

  function goToStep3() {
    if (whtApplicable && whtAmount < 0) { setError('WHT amount cannot be negative.'); return }
    if (cashReceived <= 0 && !whtApplicable) { setError('Cash received must be greater than 0.'); return }
    // If not wht, fill cash
    if (!whtApplicable) {
      setCashReceivedStr(invoiceTotal > 0 ? invoiceTotal.toFixed(2) : cashReceivedStr)
    }
    setError(null)
    setOverpaymentInfo(null)
    setStep(3)
  }

  function handleSubmit(confirmOverpayment = false) {
    const actualCash = whtApplicable ? cashReceived : (parseFloat(cashReceivedStr) || invoiceTotal)
    const actualWht = whtApplicable ? whtAmount : 0

    startTransition(async () => {
      const result = await logPaymentAction({
        campaignId,
        documentId: selectedInvoiceId || null,
        paymentDate,
        paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        whtApplicable: whtApplicable && actualWht > 0,
        whtType: whtApplicable ? whtType : undefined,
        whtRate: whtApplicable ? whtRatePct / 100 : undefined,
        whtAmount: actualWht,
        whtCertificateNumber: whtCertNumber || undefined,
        whtCreditNoteNumber: whtCreditNoteNumber || undefined,
        actualCashReceived: actualCash,
        confirmOverpayment,
      })

      if (result.overpayment) {
        setOverpaymentInfo({ excess: result.excess ?? 0 })
        return
      }

      if (result.error) {
        setError(result.error)
        return
      }

      onSuccess()
      onClose()
    })
  }

  if (!open) return null

  const totalSettled = whtApplicable ? totalSettledCalc : (parseFloat(cashReceivedStr) || invoiceTotal)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Log Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">{trackerID} · {campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 border-b border-gray-100 px-5 py-3">
          {['Payment Details', 'WHT', 'Confirm'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    step === i + 1
                      ? 'bg-teal-600 text-white'
                      : step > i + 1
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-xs ${step === i + 1 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 mx-2" />}
            </div>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* ── Step 1: Payment Details ── */}
          {step === 1 && (
            <>
              {currentInvoices.length > 0 && (
                <div>
                  <Label required>Invoice</Label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className={inputCls}
                    style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                  >
                    <option value="">— Select Invoice —</option>
                    {currentInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.document_number}
                        {inv.total_amount != null ? ` — Total: ${fmt(inv.total_amount, currency)}` : ''}
                        {inv.outstanding != null ? ` — Outstanding: ${fmt(inv.outstanding, currency)}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedInvoice?.total_amount != null && (
                    <p className="text-xs text-gray-400 mt-1">
                      Invoice Total: <strong className="text-gray-700">{fmt(selectedInvoice.total_amount, currency)}</strong>
                    </p>
                  )}
                </div>
              )}

              {balanceOutstanding != null && (
                <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-blue-800">
                  Balance Outstanding: <strong className="ml-1">{fmt(balanceOutstanding, currency)}</strong>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Payment Date</Label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={inputCls}
                    style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                  />
                </div>
                <div>
                  <Label required>Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                    className={inputCls}
                    style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Payment Reference</Label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TRF/2026/00421"
                  className={inputCls}
                  style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                />
              </div>

              <div>
                <Label>Notes — optional</Label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this payment…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
                  style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={goToStep2}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white transition"
                  style={{ background: '#0D9488' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: WHT ── */}
          {step === 2 && (
            <>
              {/* WHT Applicable toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={whtApplicable}
                  onClick={() => setWhtApplicable((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${whtApplicable ? 'bg-teal-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${whtApplicable ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">WHT Applicable</span>
              </div>

              {whtApplicable && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label required>WHT Type</Label>
                      <select
                        value={whtType}
                        onChange={(e) => setWhtType(e.target.value)}
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      >
                        {Object.entries(WHT_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label required>WHT Rate (%)</Label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={whtRatePct}
                        onChange={(e) => {
                          const r = parseFloat(e.target.value) || 0
                          setWhtRatePct(r)
                          const whtAmt = (invoiceSubtotal * r) / 100
                          setWhtAmountStr(whtAmt.toFixed(2))
                          setCashReceivedStr((invoiceTotal - whtAmt).toFixed(2))
                        }}
                        disabled={whtType !== 'custom'}
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>WHT Amount ({currency})</Label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={whtAmountStr}
                        onChange={(e) => handleWhtAmountChange(e.target.value)}
                        placeholder="Auto-calculated"
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <Label>Actual Cash Received ({currency})</Label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashReceivedStr}
                        onChange={(e) => setCashReceivedStr(e.target.value)}
                        placeholder="Invoice total – WHT"
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>WHT Certificate Number</Label>
                      <input
                        value={whtCertNumber}
                        onChange={(e) => setWhtCertNumber(e.target.value)}
                        placeholder="e.g. WHT-2026-001"
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <Label>WHT Credit Note Number</Label>
                      <input
                        value={whtCreditNoteNumber}
                        onChange={(e) => setWhtCreditNoteNumber(e.target.value)}
                        placeholder="e.g. CN-2026-001"
                        className={inputCls}
                        style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  {/* Summary box */}
                  {invoiceTotal > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Gross Invoice Total</span>
                        <span className="font-semibold text-gray-900">{fmt(invoiceTotal, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">WHT Deducted</span>
                        <span className="font-semibold text-red-600">– {fmt(whtAmount, currency)}</span>
                      </div>
                      <div className="h-px bg-gray-200 my-1" />
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-semibold">Cash to be Received</span>
                        <span className="font-bold text-gray-900">{fmt(Math.max(0, cashReceived), currency)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!whtApplicable && (
                <div>
                  <Label required>Actual Cash Received ({currency})</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceivedStr}
                    onChange={(e) => setCashReceivedStr(e.target.value)}
                    placeholder={invoiceTotal > 0 ? invoiceTotal.toFixed(2) : '0.00'}
                    className={inputCls}
                    style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setError(null); setStep(1) }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={goToStep3}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white transition"
                  style={{ background: '#0D9488' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Confirmation ── */}
          {step === 3 && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 mb-3">Payment Summary</p>
                {selectedInvoice && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice</span>
                    <span className="font-medium text-gray-900">{selectedInvoice.document_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Date</span>
                  <span className="font-medium text-gray-900">
                    {new Date(paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="font-medium text-gray-900 capitalize">{paymentMethod.replace('_', ' ')}</span>
                </div>
                {reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-medium text-gray-900">{reference}</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex justify-between">
                  <span className="text-gray-500">Cash Received</span>
                  <span className="font-semibold text-gray-900">
                    {fmt(whtApplicable ? cashReceived : (parseFloat(cashReceivedStr) || invoiceTotal), currency)}
                  </span>
                </div>
                {whtApplicable && whtAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">WHT Deducted</span>
                    <span className="font-semibold text-amber-700">{fmt(whtAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span className="text-gray-700">Total Settled</span>
                  <span className="text-gray-900">{fmt(totalSettled, currency)}</span>
                </div>
                {whtApplicable && whtCertNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">WHT Cert #</span>
                    <span className="font-medium text-gray-900">{whtCertNumber}</span>
                  </div>
                )}
              </div>

              {/* Overpayment warning */}
              {overpaymentInfo && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Overpayment detected</p>
                    <p className="mt-0.5">
                      This payment exceeds the balance by <strong>{fmt(overpaymentInfo.excess, currency)}</strong>.
                      Click "Log Payment" again to confirm.
                    </p>
                  </div>
                </div>
              )}

              {balanceOutstanding != null && totalSettled > balanceOutstanding + 0.01 && !overpaymentInfo && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Total settled ({fmt(totalSettled, currency)}) exceeds balance outstanding ({fmt(balanceOutstanding, currency)}).
                  </span>
                </div>
              )}

              {balanceOutstanding != null && totalSettled <= balanceOutstanding + 0.01 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  {Math.abs(totalSettled - balanceOutstanding) < 0.01
                    ? 'This will fully settle the campaign.'
                    : `Balance remaining after: ${fmt(balanceOutstanding - totalSettled, currency)}`}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setError(null); setStep(clientWhtApplicable || whtApplicable ? 2 : 2) }}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={() => handleSubmit(!!overpaymentInfo)}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#0D9488' }}
                  onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#0b857a' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#0D9488' }}
                >
                  {isPending ? 'Logging…' : 'Log Payment'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
