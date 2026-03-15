'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { X, Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { logPoReceivedAction } from '@/lib/actions/po'

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm
        text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent
        transition disabled:bg-gray-50 disabled:text-gray-400 ${props.className ?? ''}`}
      style={{ '--tw-ring-color': '#0D9488', ...props.style } as React.CSSProperties}
    />
  )
}

export default function PoLogModal({
  open,
  onClose,
  onSuccess,
  campaignId,
  trackerID,
  campaignTitle,
  currency,
  plannedValue,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  campaignId: string
  trackerID: string
  campaignTitle: string
  currency: string
  plannedValue: number | null
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [poNumber, setPoNumber] = useState('')
  const [poDate, setPoDate] = useState(today())
  const [poAmountStr, setPoAmountStr] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const poAmount = poAmountStr ? parseFloat(poAmountStr) : null
  const mismatchPct =
    poAmount != null && plannedValue != null && plannedValue > 0
      ? ((poAmount - plannedValue) / plannedValue) * 100
      : null
  const hasMismatch = mismatchPct != null && Math.abs(mismatchPct) > 5

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setPoNumber('')
      setPoDate(today())
      setPoAmountStr('')
      setNotes('')
      setSelectedFile(null)
      setError(null)
      setUploadError(null)
    }
  }, [open])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
    setUploadError(null)
  }

  function handleRemoveFile() {
    setSelectedFile(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit() {
    if (!poNumber.trim()) { setError('PO Number is required.'); return }
    if (!poDate) { setError('PO Date is required.'); return }
    setError(null)

    startTransition(async () => {
      let filePath: string | null = null
      let fileUrl: string | null = null
      let fileName: string | null = null
      let fileSizeBytes: number | null = null

      if (selectedFile) {
        const fd = new FormData()
        fd.append('file', selectedFile)
        const res = await fetch(`/api/campaigns/${campaignId}/upload-doc`, {
          method: 'POST',
          body: fd,
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          setUploadError(json.error ?? 'File upload failed.')
          return
        }
        filePath = json.filePath
        fileUrl = json.fileUrl
        fileName = json.fileName
        fileSizeBytes = json.fileSizeBytes
      }

      const result = await logPoReceivedAction({
        campaignId,
        poNumber: poNumber.trim(),
        poDate,
        poAmount,
        filePath,
        fileUrl,
        fileName,
        fileSizeBytes,
        notes,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      onSuccess()
      onClose()
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Log PO Received</h2>
            <p className="text-xs text-gray-400 mt-0.5">{trackerID} · {campaignTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Planned value banner */}
          {plannedValue != null && (
            <div className="flex items-start gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Planned contract value: <strong>{fmt(plannedValue, currency)}</strong>
              </span>
            </div>
          )}

          {/* PO Reference fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label required>PO Number</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2026-0042"
              />
            </div>
            <div>
              <Label required>PO Date</Label>
              <Input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>PO Amount ({currency}) — optional</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={poAmountStr}
              onChange={(e) => setPoAmountStr(e.target.value)}
              placeholder="Leave blank if same as proforma"
            />
            <p className="text-xs text-gray-400 mt-1">
              If entered, will be compared against the proforma value.
            </p>
          </div>

          {hasMismatch && (
            <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                PO amount ({fmt(poAmount!, currency)}) differs from planned value (
                {fmt(plannedValue!, currency)}) by{' '}
                <strong>{Math.abs(mismatchPct!).toFixed(1)}%</strong>. A mismatch record will be
                logged automatically.
              </span>
            </div>
          )}

          {poAmount != null && plannedValue != null && !hasMismatch && poAmountStr && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              PO amount matches planned value.
            </div>
          )}

          {/* File upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">PO Document — optional</p>
            <p className="text-xs text-gray-400">Accepted: PDF, Excel, Word, Images (max 20 MB)</p>

            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors">
                <Upload className="h-7 w-7 text-gray-300" />
                <span className="text-sm text-gray-500">Click to select a file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-teal-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-teal-100 transition text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>

          {/* Notes */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Notes — optional</p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this PO…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !poNumber.trim() || !poDate}
              className="flex-1 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5
                rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0D9488' }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#0b857a' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0D9488' }}
            >
              {isPending ? 'Logging PO…' : 'Log PO Received'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
