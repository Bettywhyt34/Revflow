'use client'

import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Upload, FileSpreadsheet, FileText,
  CheckCircle2, AlertTriangle, XCircle, Loader2,
  ChevronRight, ChevronLeft, X, TrendingUp, TrendingDown,
} from 'lucide-react'
import { confirmComplianceAction, raiseDisputeAction } from '@/lib/actions/compliance'
import type { DetectionConfidence, ExtractionMethod } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExtractionResponse {
  ok: boolean
  filePath: string
  fileUrl: string
  signedUrl: string
  fileName: string
  fileSizeBytes: number
  fileType: string
  extractionMethod: ExtractionMethod
  detectedAmount: number | null
  confidence: DetectionConfidence
  reasoning: string
  previewRows: unknown[][] | null
  pdfTextSnippet: string | null
  error?: string
}

type Step = 'pick' | 'uploading' | 'review' | 'calculate' | 'saving' | 'dispute' | 'done'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtShort(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function ConfidenceBadge({ confidence }: { confidence: DetectionConfidence }) {
  const config = {
    high:      { label: 'HIGH — Confident',  icon: CheckCircle2,   cls: 'bg-green-50 text-green-700 border-green-200' },
    medium:    { label: 'MEDIUM — Review',   icon: AlertTriangle,  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    low:       { label: 'LOW — Verify',      icon: AlertTriangle,  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    not_found: { label: 'NOT FOUND',         icon: XCircle,        cls: 'bg-red-50 text-red-600 border-red-200' },
  }
  const { label, icon: Icon, cls } = config[confidence]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cls}`}>
      <Icon className="h-4 w-4" />
      {label}
    </span>
  )
}

function ExcelPreview({ rows }: { rows: unknown[][] }) {
  const display = rows.filter((r) => (r as unknown[]).some((c) => String(c ?? '').trim() !== '')).slice(0, 20)
  if (display.length === 0) return <p className="text-sm text-gray-400 p-4">Empty spreadsheet</p>
  const maxCols = Math.min(Math.max(...display.map((r) => (r as unknown[]).length)), 8)
  return (
    <div className="overflow-auto max-h-56 rounded-lg border border-gray-200 text-xs">
      <table className="w-full">
        <tbody>
          {display.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              {Array.from({ length: maxCols }).map((_, ci) => (
                <td key={ci} className="px-2 py-1.5 border-b border-r border-gray-100 text-gray-700 whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">
                  {String((row as unknown[])[ci] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 ' +
  'bg-white focus:outline-none focus:ring-2 focus:border-transparent transition'

// ── Main component ────────────────────────────────────────────────────────────
export default function ComplianceUploadClient({
  campaignId,
  trackerID,
  campaignTitle,
  advertiser,
  plannedValue,
  currency,
  alreadyUploaded,
  existingCompliancePct,
  existingFinalBillable,
}: {
  campaignId: string
  trackerID: string
  campaignTitle: string
  advertiser: string
  plannedValue: number | null
  currency: string
  alreadyUploaded: boolean
  existingCompliancePct: number | null
  existingFinalBillable: number | null
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('pick')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Dispute fields
  const [disputeReason, setDisputeReason] = useState('')
  const [disputedAmountStr, setDisputedAmountStr] = useState('')
  const [disputeNotes, setDisputeNotes] = useState('')
  const [disputeError, setDisputeError] = useState<string | null>(null)
  const [, startDisputeTransition] = useTransition()

  const ALLOWED_EXT = ['.pdf', '.xlsx', '.xls']

  function validateFile(f: File): string | null {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) return 'Only PDF and Excel (.xlsx, .xls) files are accepted.'
    if (f.size > 20 * 1024 * 1024) return 'File must be under 20 MB.'
    return null
  }

  function handleFileChange(f: File) {
    const err = validateFile(f)
    if (err) { setUploadError(err); return }
    setUploadError(null)
    setSelectedFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploadError(null)
    setStep('uploading')

    const fd = new FormData()
    fd.append('file', selectedFile)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/compliance-extract`, {
        method: 'POST',
        body: fd,
      })
      const data: ExtractionResponse = await res.json()

      if (!res.ok || !data.ok) {
        setUploadError(data.error ?? 'Upload failed. Please try again.')
        setStep('pick')
        return
      }

      setExtraction(data)
      setConfirmedAmount(data.detectedAmount != null ? String(data.detectedAmount) : '')
      setStep('review')
    } catch {
      setUploadError('Network error. Please try again.')
      setStep('pick')
    }
  }

  function handleGoToCalculate() {
    const amount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) {
      setActionError('Please enter a valid amount before proceeding.')
      return
    }
    setActionError(null)
    setStep('calculate')
  }

  function handleConfirmCompliance() {
    if (!extraction) return
    const amount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) return

    setActionError(null)
    setStep('saving')

    startTransition(async () => {
      const result = await confirmComplianceAction({
        campaignId,
        complianceAmount: amount,
        filePath: extraction.filePath,
        fileUrl: extraction.fileUrl,
        fileName: extraction.fileName,
        fileSizeBytes: extraction.fileSizeBytes,
        fileType: extraction.fileType,
        extractionMethod: extraction.extractionMethod,
        detectedAmount: extraction.detectedAmount,
        confidence: extraction.confidence,
        extractionResult: {
          reasoning: extraction.reasoning,
          pdfTextSnippet: extraction.pdfTextSnippet,
        },
      })

      if (result.error) {
        setActionError(result.error)
        setStep('calculate')
        return
      }

      setStep('done')
      router.refresh()
    })
  }

  function handleRaiseDispute() {
    const amount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
    setDisputedAmountStr(isNaN(amount) ? '' : String(amount))
    setDisputeReason('')
    setDisputeNotes('')
    setDisputeError(null)
    setStep('dispute')
  }

  function handleSubmitDispute() {
    if (!disputeReason.trim()) { setDisputeError('Reason is required.'); return }
    const dAmt = parseFloat(disputedAmountStr)
    if (isNaN(dAmt) || dAmt <= 0) { setDisputeError('Enter a valid disputed amount.'); return }

    const originalAmount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, '')) || 0

    setDisputeError(null)

    startDisputeTransition(async () => {
      const result = await raiseDisputeAction({
        campaignId,
        reason: disputeReason.trim(),
        disputedAmount: dAmt,
        originalAmount,
        notes: disputeNotes.trim() || undefined,
      })

      if (result.error) { setDisputeError(result.error); return }

      setStep('done')
      router.refresh()
    })
  }

  // ── Compliance calculation ─────────────────────────────────────────────────
  const complianceAmt = parseFloat(confirmedAmount.replace(/[₦,\s]/g, '')) || 0
  const planAmt = plannedValue ?? 0
  const compliancePct = planAmt > 0 ? complianceAmt / planAmt : 0
  const overDelivery = complianceAmt > planAmt
  const finalBillable = overDelivery ? planAmt : complianceAmt
  const writeOff = planAmt - finalBillable

  const isExcel = extraction?.fileType === 'excel'
  const canGoCalculate = complianceAmt > 0

  // ── Step: pick ─────────────────────────────────────────────────────────────
  if (step === 'pick' || step === 'uploading') {
    return (
      <div className="space-y-6">
        <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back to Campaign
        </Link>

        <div>
          <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
          <h1 className="text-2xl font-bold text-gray-900">Upload Compliance Document</h1>
          <p className="mt-1 text-sm text-gray-500">{advertiser} — {campaignTitle}</p>
        </div>

        {alreadyUploaded && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Compliance already uploaded</p>
              <p className="mt-0.5">
                Current: {existingCompliancePct != null ? `${(existingCompliancePct * 100).toFixed(1)}%` : '—'} compliance.
                Final Billable: {existingFinalBillable != null ? fmtShort(existingFinalBillable, currency) : '—'}.
                Uploading a new compliance document will overwrite the existing values.
              </p>
            </div>
          </div>
        )}

        {plannedValue != null && (
          <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-800">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span>Planned Contract Value (Plan Amount Before VAT): <strong>{fmtShort(plannedValue, currency)}</strong></span>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 sm:p-16 cursor-pointer transition-colors ${
            dragOver ? 'border-[#0D9488] bg-teal-50'
            : selectedFile ? 'border-teal-300 bg-teal-50/40'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          }`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }} />

          {selectedFile ? (
            <>
              {selectedFile.name.toLowerCase().endsWith('.pdf')
                ? <FileText className="h-10 w-10 text-[#0D9488]" />
                : <FileSpreadsheet className="h-10 w-10 text-[#0D9488]" />}
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatBytes(selectedFile.size)}</p>
              </div>
              <p className="text-xs text-gray-400">Click to change file</p>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">
                  {dragOver ? 'Drop it here' : 'Drop compliance file here or click to browse'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx, .xls) — Max 20 MB</p>
              </div>
            </>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{uploadError}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || step === 'uploading'}
          className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: '#0D9488' }}
        >
          {step === 'uploading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading &amp; Extracting…</>
          ) : (
            <><Upload className="h-4 w-4" /> Upload &amp; Extract</>
          )}
        </button>
      </div>
    )
  }

  // ── Step: review (amount confirmation) ────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="space-y-6">
        <button onClick={() => { setStep('pick'); setExtraction(null); setSelectedFile(null) }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
          <h1 className="text-2xl font-bold text-gray-900">Review Extraction</h1>
          <p className="mt-1 text-sm text-gray-500">Confirm the Compliance Amount Before VAT</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isExcel ? <FileSpreadsheet className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4 text-red-500" />}
              <span className="text-sm font-medium text-gray-700 truncate">{extraction!.fileName}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(extraction!.fileSizeBytes)}</span>
            </div>
            {isExcel && extraction!.previewRows ? (
              <ExcelPreview rows={extraction!.previewRows} />
            ) : extraction!.signedUrl ? (
              <div className="hidden sm:block rounded-lg border border-gray-200 overflow-hidden" style={{ height: '280px' }}>
                <iframe src={extraction!.signedUrl} className="w-full h-full" title={extraction!.fileName} />
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">Preview not available</div>
            )}
          </div>

          {/* Extraction result + confirm */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Detected Compliance Amount Before VAT</h2>

              <div className="space-y-2">
                {extraction!.detectedAmount != null ? (
                  <p className="text-2xl font-bold text-gray-900 font-mono">
                    {fmt(extraction!.detectedAmount, currency)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No amount detected automatically</p>
                )}
                <ConfidenceBadge confidence={extraction!.confidence} />
              </div>

              {extraction!.reasoning && (
                <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
                  <p className="text-xs text-gray-500 leading-relaxed">{extraction!.reasoning}</p>
                </div>
              )}

              <hr className="border-gray-100" />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Compliance Amount Before VAT <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">₦</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-mono text-gray-900 outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition"
                  />
                </div>
                <p className="text-xs text-gray-400">Amount delivered before VAT — from the compliance document</p>
              </div>

              {actionError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{actionError}</p>
              )}

              <button
                onClick={handleGoToCalculate}
                disabled={!canGoCalculate}
                className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#0D9488' }}
              >
                <span>View Compliance Calculation</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => { setStep('pick'); setExtraction(null); setSelectedFile(null) }}
              className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
            >
              ← Re-upload different file
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: calculate ────────────────────────────────────────────────────────
  if (step === 'calculate' || step === 'saving') {
    const pctStr = planAmt > 0 ? `${(compliancePct * 100).toFixed(2)}%` : '—'
    const pctColor =
      compliancePct >= 0.9 ? 'text-green-600' :
      compliancePct >= 0.7 ? 'text-amber-600' :
      'text-red-600'

    return (
      <div className="space-y-6 max-w-2xl">
        <button onClick={() => { setStep('review'); setActionError(null) }}
          disabled={step === 'saving'}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px] disabled:opacity-50">
          <ChevronLeft className="h-4 w-4" /> Back to Review
        </button>

        <div>
          <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Calculation</h1>
          <p className="mt-1 text-sm text-gray-500">Review the compliance figures before confirming</p>
        </div>

        {/* Over-delivery banner */}
        {overDelivery && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <TrendingUp className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Over-delivery detected: {((compliancePct - 1) * 100).toFixed(2)}% above plan</p>
              <p className="mt-0.5 text-xs">Final Billable is capped at Planned Contract Value. The excess delivery is not billed.</p>
            </div>
          </div>
        )}

        {/* Calculation breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Calculation Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Plan Amount Before VAT</span>
              <span className="font-semibold text-gray-900 font-mono">
                {planAmt > 0 ? fmt(planAmt, currency) : '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Compliance Amount Before VAT</span>
              <span className="font-semibold text-gray-900 font-mono">{fmt(complianceAmt, currency)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                Compliance %
                {compliancePct >= 1 ? <TrendingUp className="h-3.5 w-3.5 text-green-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
              </span>
              <span className={`font-bold font-mono text-base ${pctColor}`}>{pctStr}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Planned Contract Value</span>
              <span className="font-semibold text-gray-900 font-mono">
                {planAmt > 0 ? fmt(planAmt, currency) : '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="font-bold text-gray-800">Final Billable</span>
              <span className="font-bold text-gray-900 font-mono text-base">{fmt(finalBillable, currency)}</span>
            </div>
            {writeOff > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Write-Off</span>
                <span className="font-semibold text-red-600 font-mono">{fmt(writeOff, currency)}</span>
              </div>
            )}
          </div>
        </div>

        {actionError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{actionError}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRaiseDispute}
            disabled={step === 'saving'}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg text-sm font-medium border border-amber-300 text-amber-700 hover:bg-amber-50 transition disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            Raise Dispute
          </button>
          <button
            onClick={handleConfirmCompliance}
            disabled={step === 'saving'}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#0D9488' }}
            onMouseEnter={(e) => { if (step !== 'saving') e.currentTarget.style.background = '#0b857a' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0D9488' }}
          >
            {step === 'saving' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Confirm Compliance</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Step: dispute ──────────────────────────────────────────────────────────
  if (step === 'dispute') {
    return (
      <div className="space-y-6 max-w-lg">
        <button onClick={() => { setStep('calculate'); setDisputeError(null) }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px]">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
          <h1 className="text-xl font-bold text-gray-900">Raise Compliance Dispute</h1>
          <p className="mt-1 text-sm text-gray-500">This will flag the campaign for Finance Exec + Admin review.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Dispute <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain why you are disputing this compliance amount…"
              className={`${inputCls} resize-none`}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Disputed Amount ({currency}) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={disputedAmountStr}
              onChange={(e) => setDisputedAmountStr(e.target.value)}
              placeholder="Enter the amount you believe is correct"
              className={inputCls}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Notes — optional</label>
            <textarea
              rows={2}
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              placeholder="Any additional context…"
              className={`${inputCls} resize-none`}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>

          {disputeError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{disputeError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setStep('calculate'); setDisputeError(null) }}
              className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </button>
            <button
              onClick={handleSubmitDispute}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg text-sm font-semibold text-white transition"
              style={{ background: '#d97706' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#b45309')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#d97706')}
            >
              <AlertTriangle className="h-4 w-4" /> Raise Dispute
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: done ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg text-center py-12">
      <div className="h-16 w-16 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {step === 'done' ? 'Compliance Confirmed' : 'Done'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Campaign status updated to Compliance Uploaded.
        </p>
      </div>
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-lg text-sm font-semibold text-white transition"
        style={{ background: '#0D9488' }}
      >
        Back to Campaign
      </Link>
    </div>
  )
}
