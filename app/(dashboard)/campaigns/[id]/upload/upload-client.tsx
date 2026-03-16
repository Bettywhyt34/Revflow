'use client'

import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldAlert } from 'lucide-react'
import { saveUploadRecordAction } from '@/lib/actions/upload'
import type { DetectionConfidence, ExtractionMethod, UserRole } from '@/types'

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function ConfidenceBadge({ confidence }: { confidence: DetectionConfidence }) {
  const config = {
    high:      { label: 'HIGH — Confident',  icon: CheckCircle2,   classes: 'bg-green-50 text-green-700 border border-green-200' },
    medium:    { label: 'MEDIUM — Review',   icon: AlertTriangle,  classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
    low:       { label: 'LOW — Verify',      icon: AlertTriangle,  classes: 'bg-orange-50 text-orange-700 border border-orange-200' },
    not_found: { label: 'NOT FOUND',         icon: XCircle,        classes: 'bg-red-50 text-red-600 border border-red-200' },
  }
  const { label, icon: Icon, classes } = config[confidence]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${classes}`}>
      <Icon className="h-4 w-4" />
      {label}
    </span>
  )
}

// ── Excel preview table ───────────────────────────────────────────────────────
function ExcelPreview({ rows }: { rows: unknown[][] }) {
  const display = rows.filter((r) => (r as unknown[]).some((c) => String(c ?? '').trim() !== '')).slice(0, 25)
  if (display.length === 0) return <p className="text-sm text-gray-400 p-4">Empty spreadsheet</p>

  const maxCols = Math.max(...display.map((r) => (r as unknown[]).length))
  const cols = Math.min(maxCols, 8) // cap at 8 cols for display

  return (
    <div className="overflow-auto max-h-72 rounded-lg border border-gray-200 text-xs">
      <table className="w-full">
        <tbody>
          {display.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              {Array.from({ length: cols }).map((_, ci) => (
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

// ── PDF preview ───────────────────────────────────────────────────────────────
function PdfPreview({ signedUrl, fileName }: { signedUrl: string; fileName: string }) {
  return (
    <div className="space-y-2">
      {/* Desktop: inline iframe */}
      <div className="hidden sm:block rounded-lg border border-gray-200 overflow-hidden" style={{ height: '320px' }}>
        <iframe src={signedUrl} className="w-full h-full" title={fileName} />
      </div>
      {/* Mobile: download link */}
      <div className="sm:hidden">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <FileText className="h-4 w-4 text-[#0D9488]" />
          Open PDF
        </a>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UploadClient({
  campaignId,
  trackerID,
  campaignTitle,
  advertiser,
  userRole,
}: {
  campaignId: string
  trackerID: string
  campaignTitle: string
  advertiser: string
  userRole: UserRole
}) {
  // Step state
  type Step = 'pick' | 'uploading' | 'confirm' | 'saving'
  const [step, setStep] = useState<Step>('pick')

  // File pick
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Upload / extraction result
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Confirm
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [, startSaveTransition] = useTransition()

  // Admin override (blocked by payments)
  const [blockedByPayments, setBlockedByPayments] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

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
      const res = await fetch(`/api/campaigns/${campaignId}/extract`, {
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
      setStep('confirm')
    } catch {
      setUploadError('Network error. Please try again.')
      setStep('pick')
    }
  }

  function buildSavePayload(adminOverride = false) {
    if (!extraction) return null
    const amount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
    return {
      campaignId,
      filePath: extraction.filePath,
      fileUrl: extraction.fileUrl,
      fileName: extraction.fileName,
      fileSizeBytes: extraction.fileSizeBytes,
      fileType: extraction.fileType,
      extractionMethod: extraction.extractionMethod,
      detectedAmountBeforeVat: extraction.detectedAmount,
      confirmedAmountBeforeVat: amount,
      detectionConfidence: extraction.confidence,
      extractionResult: {
        reasoning: extraction.reasoning,
        pdfTextSnippet: extraction.pdfTextSnippet,
      },
      adminOverride,
      adminOverrideReason: adminOverride ? overrideReason : undefined,
    }
  }

  function handleConfirm(adminOverride = false) {
    if (!extraction) return
    const amount = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) {
      setSaveError('Please enter a valid amount before confirming.')
      return
    }

    setSaveError(null)
    setStep('saving')

    startSaveTransition(async () => {
      const payload = buildSavePayload(adminOverride)
      if (!payload) return
      const result = await saveUploadRecordAction(payload)
      if (result && 'error' in result) {
        if (result.error === 'BLOCKED_BY_PAYMENTS') {
          setBlockedByPayments(true)
          setStep('confirm')
        } else {
          setSaveError(result.error)
          setStep('confirm')
        }
      }
      // On success, redirect is handled by server action
    })
  }

  const isExcel = extraction?.fileType === 'excel'
  const amountValue = parseFloat(confirmedAmount.replace(/[₦,\s]/g, ''))
  const canConfirm = !isNaN(amountValue) && amountValue > 0

  // ── Step 1: File picker ──────────────────────────────────────────────────
  if (step === 'pick' || step === 'uploading') {
    return (
      <div className="space-y-6">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaign
        </Link>

        <div>
          <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Upload Plan / MPO</h1>
          <p className="mt-1 text-sm text-gray-500">{advertiser} — {campaignTitle}</p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 sm:p-16 cursor-pointer transition-colors ${
            dragOver
              ? 'border-[#0D9488] bg-teal-50'
              : selectedFile
              ? 'border-teal-300 bg-teal-50/40'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
          />

          {selectedFile ? (
            <>
              {selectedFile.name.toLowerCase().endsWith('.pdf')
                ? <FileText className="h-10 w-10 text-[#0D9488]" />
                : <FileSpreadsheet className="h-10 w-10 text-[#0D9488]" />
              }
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
                  {dragOver ? 'Drop it here' : 'Drop file here or click to browse'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, Excel (.xlsx, .xls) — Max 20 MB</p>
              </div>
            </>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3" role="alert">
            {uploadError}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || step === 'uploading'}
          className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: '#0D9488' }}
        >
          {step === 'uploading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading &amp; Extracting…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload &amp; Extract
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-400">
          The file will be stored securely. Amount Before VAT will be auto-detected.
        </p>
      </div>
    )
  }

  // ── Step 2: Confirm ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaign
      </Link>

      <div>
        <p className="text-xs font-mono font-semibold text-[#0D9488] mb-1">{trackerID}</p>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Review Extraction</h1>
        <p className="mt-1 text-sm text-gray-500">
          Confirm the Amount Before VAT before saving
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: document preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {isExcel
              ? <FileSpreadsheet className="h-4 w-4 text-green-600" />
              : <FileText className="h-4 w-4 text-red-500" />
            }
            <span className="text-sm font-medium text-gray-700 truncate">{extraction!.fileName}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(extraction!.fileSizeBytes)}</span>
          </div>

          {isExcel && extraction!.previewRows ? (
            <ExcelPreview rows={extraction!.previewRows} />
          ) : extraction!.signedUrl ? (
            <PdfPreview signedUrl={extraction!.signedUrl} fileName={extraction!.fileName} />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              Preview not available
            </div>
          )}
        </div>

        {/* Right: extraction result + confirm */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Detected Amount Before VAT</h2>

            <div className="space-y-2">
              {extraction!.detectedAmount != null ? (
                <p className="text-2xl font-bold text-gray-900 font-mono">
                  {formatAmount(extraction!.detectedAmount)}
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

            {/* Editable confirm field */}
            <div className="space-y-1.5">
              <label htmlFor="confirmedAmount" className="block text-sm font-medium text-gray-700">
                Confirm Amount Before VAT <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                  ₦
                </span>
                <input
                  id="confirmedAmount"
                  type="text"
                  inputMode="numeric"
                  value={confirmedAmount}
                  onChange={(e) => setConfirmedAmount(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-mono text-gray-900 outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition"
                />
              </div>
              <p className="text-xs text-gray-400">
                This is the pre-VAT contract value — not the grand total
              </p>
            </div>

            {saveError && !blockedByPayments && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5" role="alert">
                {saveError}
              </p>
            )}

            {/* Blocked by payments — admin override section */}
            {blockedByPayments && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3.5 space-y-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>Re-upload blocked:</strong> This campaign has existing payments. Re-uploading will flag current proforma/invoice documents as OUTDATED.
                  </p>
                </div>
                {userRole === 'admin' ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-amber-900">
                      Override reason (admin only) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                      placeholder="State why this re-upload is necessary despite existing payments…"
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 text-sm bg-white resize-none focus:outline-none focus:ring-2"
                    />
                    <button
                      onClick={() => handleConfirm(true)}
                      disabled={!overrideReason.trim() || step === 'saving'}
                      className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700"
                    >
                      Override &amp; Save
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">Contact an admin to override this restriction.</p>
                )}
              </div>
            )}

            {!blockedByPayments && (
              <>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={!canConfirm || step === 'saving'}
                  className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#0D9488' }}
                >
                  {step === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm &amp; Save
                    </>
                  )}
                </button>
                {!canConfirm && (
                  <p className="text-xs text-center text-amber-600">
                    Enter a valid amount to proceed
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => { setStep('pick'); setExtraction(null); setSelectedFile(null); setUploadError(null); setBlockedByPayments(false) }}
            className="w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
          >
            ← Re-upload different file
          </button>
        </div>
      </div>
    </div>
  )
}
