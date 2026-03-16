'use client'

import { useState } from 'react'
import { X, ChevronUp, ChevronDown, Download, Loader2, FileText } from 'lucide-react'
import type { DocumentRow } from '@/lib/data/documents'

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

interface CustomBundleModalProps {
  documents: DocumentRow[]
  campaignId: string
  currency: string
  onClose: () => void
}

export default function CustomBundleModal({
  documents,
  campaignId,
  currency,
  onClose,
}: CustomBundleModalProps) {
  // Pre-select CURRENT docs, order by spec
  const SPEC_ORDER = ['invoice', 'purchase_order', 'proforma_invoice', 'compliance_report', 'compliance']
  const sortedDocs = [...documents]
    .filter((d) => d.status === 'current' || d.status === 'superseded')
    .sort((a, b) => {
      const ai = SPEC_ORDER.indexOf(a.type)
      const bi = SPEC_ORDER.indexOf(b.type)
      const aIdx = ai === -1 ? 99 : ai
      const bIdx = bi === -1 ? 99 : bi
      if (aIdx !== bIdx) return aIdx - bIdx
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

  const [selected, setSelected] = useState<Set<string>>(
    new Set(sortedDocs.filter((d) => d.status === 'current').map((d) => d.id)),
  )
  const [order, setOrder] = useState<string[]>(sortedDocs.map((d) => d.id))
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function moveUp(id: string) {
    setOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  function moveDown(id: string) {
    setOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx === -1 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const orderedDocs = order.map((id) => sortedDocs.find((d) => d.id === id)).filter(Boolean) as DocumentRow[]
  const selectedIds = order.filter((id) => selected.has(id))

  async function handleBuildAndDownload() {
    if (selectedIds.length === 0) {
      setBuildError('Select at least one document.')
      return
    }
    setIsBuilding(true)
    setBuildError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/bundle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_type: 'custom',
          document_ids: selectedIds,
          order: selectedIds,
        }),
      })
      const json = await res.json() as { download_url?: string; error?: string }
      if (!res.ok || !json.download_url) {
        setBuildError(json.error ?? 'Failed to generate bundle.')
        return
      }
      const a = document.createElement('a')
      a.href = json.download_url
      a.download = `custom-bundle-${campaignId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      onClose()
    } catch {
      setBuildError('Network error. Please try again.')
    } finally {
      setIsBuilding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Custom Bundle</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <p className="text-xs text-gray-500 mb-3">
            Select documents and reorder using the arrows. The bundle will be merged in the displayed order.
          </p>

          {orderedDocs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No selectable documents.</p>
          ) : (
            orderedDocs.map((doc, idx) => (
              <div
                key={doc.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  selected.has(doc.id) ? 'border-teal-200 bg-teal-50/30' : 'border-gray-100 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {TYPE_LABELS[doc.type] ?? doc.type}
                  </p>
                  <p className="text-[11px] text-gray-400">{doc.document_number}</p>
                </div>
                {doc.total_amount != null && (
                  <span className="text-xs text-gray-600 tabular-nums flex-shrink-0 hidden sm:inline">
                    {formatCurrency(doc.total_amount, doc.currency ?? currency)}
                  </span>
                )}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveUp(doc.id)}
                    disabled={idx === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveDown(doc.id)}
                    disabled={idx === orderedDocs.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          {buildError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {buildError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleBuildAndDownload}
              disabled={isBuilding || selectedIds.length === 0}
              className="flex-1 min-h-[44px] rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#0D9488' }}
            >
              {isBuilding ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Building…</>
              ) : (
                <><Download className="h-4 w-4" />Build &amp; Download ({selectedIds.length})</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
