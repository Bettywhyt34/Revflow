'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  FileText, Download, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, XCircle, Package,
} from 'lucide-react'
import { voidDocumentAction, markDocumentReviewedAction } from '@/lib/actions/documents'
import type { DocumentRow, UploadRecordRow } from '@/lib/data/documents'
import type { UserRole } from '@/types'
import CustomBundleModal from './custom-bundle-modal'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  proforma_invoice: 'Proforma Invoice',
  invoice: 'Invoice',
  purchase_order: 'Purchase Order',
  compliance: 'Compliance',
  compliance_report: 'Compliance Report',
  receipt: 'Receipt',
}

function formatCurrency(value: number | null, currency = 'NGN'): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-blue-50 text-blue-700 border-blue-200',
    current: 'bg-green-50 text-green-700 border-green-200',
    outdated: 'bg-amber-50 text-amber-700 border-amber-200',
    superseded: 'bg-gray-100 text-gray-500 border-gray-200',
    void: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wide ${map[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface DocumentBundleProps {
  documents: DocumentRow[]
  uploadRecord: UploadRecordRow | null
  campaignId: string
  orgId: string
  userRole: UserRole
  currency: string
  writeOff: number
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentBundle({
  documents,
  uploadRecord,
  campaignId,
  userRole,
  currency,
}: DocumentBundleProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [showVoided, setShowVoided] = useState(false)
  const [customBundleOpen, setCustomBundleOpen] = useState(false)

  // Void state
  const [voidingDocId, setVoidingDocId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)
  const [, startVoidTransition] = useTransition()

  // Review state
  const [, startReviewTransition] = useTransition()
  const [reviewError, setReviewError] = useState<string | null>(null)

  const activeDocs = documents.filter((d) => d.status !== 'void')
  const voidedDocs = documents.filter((d) => d.status === 'void')
  const outdatedDocs = activeDocs.filter((d) => d.status === 'outdated')

  async function handleDownloadAll() {
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_type: 'full' }),
      })
      const json = await res.json() as { download_url?: string; error?: string }
      if (!res.ok || !json.download_url) {
        setDownloadError(json.error ?? 'Failed to generate bundle.')
        return
      }
      // Trigger download
      const a = document.createElement('a')
      a.href = json.download_url
      a.download = `bundle-${campaignId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      setDownloadError('Network error. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleVoidConfirm(docId: string) {
    setVoidError(null)
    startVoidTransition(async () => {
      const res = await voidDocumentAction(docId, voidReason)
      if (res.error) {
        setVoidError(res.error)
      } else {
        setVoidingDocId(null)
        setVoidReason('')
      }
    })
  }

  function handleMarkReviewed(docId: string) {
    setReviewError(null)
    startReviewTransition(async () => {
      const res = await markDocumentReviewedAction(docId)
      if (res.error) setReviewError(res.error)
    })
  }

  const docHref = (doc: DocumentRow) => {
    if (doc.type === 'proforma_invoice') return `/campaigns/${campaignId}/proforma/${doc.id}`
    if (doc.type === 'invoice') return `/campaigns/${campaignId}/invoice/${doc.id}`
    return null
  }

  const hasContent = activeDocs.length > 0 || uploadRecord != null

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-400" />
          Document Bundle
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCustomBundleOpen(true)}
            disabled={activeDocs.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
          >
            Custom Bundle
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={isDownloading || !hasContent}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50"
            style={{ background: '#0D9488' }}
          >
            {isDownloading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
            ) : (
              <><Download className="h-3.5 w-3.5" />Download All</>
            )}
          </button>
        </div>
      </div>

      {downloadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {downloadError}
        </p>
      )}

      {reviewError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {reviewError}
        </p>
      )}

      {/* OUTDATED banner */}
      {outdatedDocs.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            {outdatedDocs.length} document{outdatedDocs.length > 1 ? 's' : ''} flagged <strong>OUTDATED</strong> due to plan re-upload. Review and mark as current when confirmed.
          </p>
        </div>
      )}

      {!hasContent ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-10 w-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
            <FileText className="h-5 w-5 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Active documents */}
          {activeDocs.map((doc) => {
            const href = docHref(doc)
            const isOutdated = doc.status === 'outdated'
            const canVoid = userRole === 'admin' && doc.status !== 'void'
            const canReview = (userRole === 'admin' || userRole === 'finance_exec') && isOutdated

            return (
              <div
                key={doc.id}
                className={`rounded-lg border px-3 py-2.5 space-y-2 ${isOutdated ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {TYPE_LABELS[doc.type] ?? doc.type}
                      </p>
                      <p className="text-[11px] text-gray-400">{doc.document_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {doc.total_amount != null && (
                      <span className="text-xs font-semibold text-gray-700 tabular-nums">
                        {formatCurrency(doc.total_amount, doc.currency ?? currency)}
                      </span>
                    )}
                    <StatusBadge status={doc.status} />
                    {doc.issue_date && (
                      <span className="text-[11px] text-gray-400 hidden sm:inline">{formatDate(doc.issue_date)}</span>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {href && (
                    <Link
                      href={href}
                      className="text-[11px] font-medium text-[#0D9488] hover:underline min-h-[28px] flex items-center"
                    >
                      View
                    </Link>
                  )}
                  {(doc.file_path || doc.type === 'proforma_invoice' || doc.type === 'invoice') && (
                    <a
                      href={doc.type === 'proforma_invoice'
                        ? `/api/proforma/${doc.id}/pdf`
                        : doc.type === 'invoice'
                          ? `/api/invoice/${doc.id}/pdf`
                          : `/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px]"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  )}
                  {canReview && (
                    <button
                      onClick={() => handleMarkReviewed(doc.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 hover:text-green-900 min-h-[28px]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark Reviewed
                    </button>
                  )}
                  {canVoid && voidingDocId !== doc.id && (
                    <button
                      onClick={() => { setVoidingDocId(doc.id); setVoidReason(''); setVoidError(null) }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 min-h-[28px] ml-auto"
                    >
                      <XCircle className="h-3 w-3" />
                      Void
                    </button>
                  )}
                </div>

                {/* Inline void confirmation */}
                {voidingDocId === doc.id && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-800">Void document?</p>
                    <textarea
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      rows={2}
                      placeholder="Reason for voiding (required)…"
                      className="w-full px-2.5 py-1.5 rounded border border-red-200 text-xs resize-none focus:outline-none"
                    />
                    {voidError && <p className="text-xs text-red-600">{voidError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVoidConfirm(doc.id)}
                        disabled={!voidReason.trim()}
                        className="min-h-[30px] px-3 py-1 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                      >
                        Confirm Void
                      </button>
                      <button
                        onClick={() => setVoidingDocId(null)}
                        className="min-h-[30px] px-3 py-1 rounded text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Upload Record (Plan) row */}
          {uploadRecord && (
            <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Media Plan / MPO
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{uploadRecord.file_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wide bg-gray-100 text-gray-500 border-gray-200">
                    plan
                  </span>
                  <span className="text-[11px] text-gray-400 hidden sm:inline">
                    {formatDate(uploadRecord.created_at)}
                  </span>
                  <a
                    href={uploadRecord.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px]"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Voided docs (admin only, collapsible) */}
          {userRole === 'admin' && voidedDocs.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowVoided((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 min-h-[28px]"
              >
                {showVoided ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {voidedDocs.length} voided document{voidedDocs.length > 1 ? 's' : ''}
              </button>

              {showVoided && (
                <div className="mt-1.5 space-y-1">
                  {voidedDocs.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-red-100 bg-red-50/30 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-400 line-through truncate">
                              {TYPE_LABELS[doc.type] ?? doc.type}
                            </p>
                            <p className="text-[11px] text-gray-400">{doc.document_number}</p>
                            {doc.void_reason && (
                              <p className="text-[11px] text-red-500 mt-0.5">Reason: {doc.void_reason}</p>
                            )}
                          </div>
                        </div>
                        <StatusBadge status="void" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {customBundleOpen && (
        <CustomBundleModal
          documents={activeDocs}
          campaignId={campaignId}
          currency={currency}
          onClose={() => setCustomBundleOpen(false)}
        />
      )}
    </div>
  )
}
