'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Download, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, XCircle, Package, Edit2, Copy,
  History, AlertCircle,
} from 'lucide-react'
import { voidDocumentAction, markDocumentReviewedAction, createVersionAction } from '@/lib/actions/documents'
import type { DocumentRow, UploadRecordRow } from '@/lib/data/documents'
import type { UserRole } from '@/types'
import CustomBundleModal from './custom-bundle-modal'
import CloneDocumentModal, { type CloneableDoc } from './clone-document-modal'

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
  uploadRecordVersion: number
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentBundle({
  documents,
  uploadRecord,
  campaignId,
  userRole,
  currency,
  uploadRecordVersion,
}: DocumentBundleProps) {
  const router = useRouter()
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [showVoided, setShowVoided] = useState(false)
  const [showSuperseded, setShowSuperseded] = useState(false)
  const [customBundleOpen, setCustomBundleOpen] = useState(false)

  // Void state
  const [voidingDocId, setVoidingDocId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)
  const [, startVoidTransition] = useTransition()

  // Review state
  const [, startReviewTransition] = useTransition()
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Edit/version state
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editReason, setEditReason] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [, startEditTransition] = useTransition()

  // Clone state
  const [cloneDoc, setCloneDoc] = useState<CloneableDoc | null>(null)

  const activeDocs = documents.filter((d) => d.status !== 'void' && d.status !== 'superseded')
  const voidedDocs = documents.filter((d) => d.status === 'void')
  const supersededDocs = documents.filter((d) => d.status === 'superseded')
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

  // Create a new version of a CURRENT/OUTDATED doc and navigate to its edit page
  function handleCreateVersion(docId: string, reason: string) {
    setEditError(null)
    startEditTransition(async () => {
      const res = await createVersionAction(docId, reason)
      if (res.error) {
        setEditError(res.error)
        return
      }
      setEditingDocId(null)
      setEditReason('')
      const { newDocId, type, campaignId: cId } = res
      if (type === 'proforma_invoice') {
        router.push(`/campaigns/${cId}/proforma/${newDocId}/edit`)
      } else if (type === 'invoice') {
        router.push(`/campaigns/${cId}/invoice/${newDocId}/edit`)
      } else {
        router.push(`/campaigns/${cId}`)
      }
    })
  }

  const docHref = (doc: DocumentRow) => {
    if (doc.type === 'proforma_invoice') return `/campaigns/${campaignId}/proforma/${doc.id}`
    if (doc.type === 'invoice') return `/campaigns/${campaignId}/invoice/${doc.id}`
    return null
  }

  const editHref = (doc: DocumentRow) => {
    if (doc.status !== 'draft') return null
    if (doc.type === 'proforma_invoice') return `/campaigns/${campaignId}/proforma/${doc.id}/edit`
    if (doc.type === 'invoice') return `/campaigns/${campaignId}/invoice/${doc.id}/edit`
    return null
  }

  const pdfHref = (doc: DocumentRow) => {
    if (doc.type === 'proforma_invoice') return `/api/proforma/${doc.id}/pdf`
    if (doc.type === 'invoice') return `/api/invoice/${doc.id}/pdf`
    if (doc.file_path) return `/api/documents/${doc.id}/download`
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
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{downloadError}</p>
      )}
      {reviewError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reviewError}</p>
      )}
      {editError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
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
            const editLink = editHref(doc)
            const pdf = pdfHref(doc)
            const isOutdated = doc.status === 'outdated'
            const isDraft = doc.status === 'draft'
            const isCurrent = doc.status === 'current'
            const canVoid = userRole === 'admin' && doc.status !== 'void'
            const canReview = (userRole === 'admin' || userRole === 'finance_exec') && isOutdated
            const canEdit = ['admin', 'finance_exec'].includes(userRole)
            const canClone = ['admin', 'finance_exec'].includes(userRole) && (doc.type === 'proforma_invoice' || doc.type === 'invoice')
            const needsVersion = (isCurrent || isOutdated) && canEdit

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
                        {(doc.version ?? 1) > 1 && (
                          <span className="ml-1.5 text-[10px] text-gray-400 font-normal">v{doc.version}</span>
                        )}
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
                    <Link href={href} className="text-[11px] font-medium text-[#0D9488] hover:underline min-h-[28px] flex items-center">
                      View
                    </Link>
                  )}
                  {pdf && (
                    <a
                      href={pdf}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px]"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  )}

                  {/* DRAFT: direct edit link */}
                  {isDraft && editLink && canEdit && (
                    <Link
                      href={editLink}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 min-h-[28px]"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </Link>
                  )}

                  {/* CURRENT / OUTDATED: create new version */}
                  {needsVersion && editingDocId !== doc.id && (
                    <button
                      onClick={() => { setEditingDocId(doc.id); setEditReason(''); setEditError(null) }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 min-h-[28px]"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                  )}

                  {canClone && (
                    <button
                      onClick={() => setCloneDoc(doc)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-800 min-h-[28px]"
                    >
                      <Copy className="h-3 w-3" />
                      Clone
                    </button>
                  )}

                  {canReview && (
                    <button
                      onClick={() => handleMarkReviewed(doc.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 hover:text-green-900 min-h-[28px]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Reviewed
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

                {/* Inline version confirmation */}
                {editingDocId === doc.id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs font-semibold text-blue-800">
                        This document has been sent. Editing will create a new version (v{(doc.version ?? 1) + 1}). The current version will be marked SUPERSEDED.
                      </p>
                    </div>
                    <input
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Reason for revision (optional)…"
                      className="w-full px-2.5 py-1.5 rounded border border-blue-200 text-xs focus:outline-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateVersion(doc.id, editReason)}
                        className="min-h-[30px] px-3 py-1 rounded text-xs font-semibold text-white transition"
                        style={{ background: '#0D9488' }}
                      >
                        Proceed
                      </button>
                      <button
                        onClick={() => setEditingDocId(null)}
                        className="min-h-[30px] px-3 py-1 rounded text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

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
                    <p className="text-sm font-medium text-gray-900 truncate">Media Plan / MPO</p>
                    <p className="text-[11px] text-gray-400 truncate">{uploadRecord.file_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wide bg-gray-100 text-gray-500 border-gray-200">
                    plan
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-teal-50 text-teal-700 border-teal-200">
                    v{uploadRecordVersion}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 tabular-nums hidden sm:inline">
                    {formatCurrency(uploadRecord.confirmed_amount_before_vat, currency)}
                  </span>
                  <span className="text-[11px] text-gray-400 hidden sm:inline">{formatDate(uploadRecord.created_at)}</span>
                  <a
                    href={uploadRecord.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px]"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                  {['admin', 'planner', 'finance_exec'].includes(userRole) && (
                    <Link
                      href={`/campaigns/${campaignId}/upload`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D9488] hover:underline min-h-[28px]"
                    >
                      Update Plan
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Superseded docs (collapsible) */}
          {supersededDocs.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowSuperseded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 min-h-[28px]"
              >
                <History className="h-3 w-3" />
                {showSuperseded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {supersededDocs.length} superseded version{supersededDocs.length > 1 ? 's' : ''}
              </button>

              {showSuperseded && (
                <div className="mt-1.5 space-y-1">
                  {supersededDocs.map((doc) => {
                    const href = docHref(doc)
                    const pdf = pdfHref(doc)
                    const canClone = ['admin', 'finance_exec', 'planner'].includes(userRole) && (doc.type === 'proforma_invoice' || doc.type === 'invoice')
                    return (
                      <div key={doc.id} className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="h-4 w-4 text-gray-300 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-400 truncate">
                                {TYPE_LABELS[doc.type] ?? doc.type}
                                {(doc.version ?? 1) > 0 && (
                                  <span className="ml-1.5 text-[10px]">v{doc.version}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-400">{doc.document_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status="superseded" />
                            {href && (
                              <Link href={href} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px] flex items-center">
                                View
                              </Link>
                            )}
                            {pdf && (
                              <a href={pdf} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 min-h-[28px]"
                              >
                                <Download className="h-3 w-3" />
                                PDF
                              </a>
                            )}
                            {canClone && (
                              <button
                                onClick={() => setCloneDoc(doc)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-500 hover:text-purple-700 min-h-[28px]"
                              >
                                <Copy className="h-3 w-3" />
                                Clone
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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

      {cloneDoc && (
        <CloneDocumentModal
          doc={cloneDoc}
          campaignId={campaignId}
          onClose={() => setCloneDoc(null)}
        />
      )}
    </div>
  )
}
