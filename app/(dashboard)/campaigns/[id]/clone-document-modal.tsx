'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Copy, Loader2 } from 'lucide-react'
import { cloneDocumentAction } from '@/lib/actions/documents'

const TYPE_LABELS: Record<string, string> = {
  proforma_invoice: 'Proforma Invoice',
  invoice: 'Invoice',
  purchase_order: 'Purchase Order',
  compliance: 'Compliance',
  compliance_report: 'Compliance Report',
}

const CLONEABLE_TYPES = ['proforma_invoice', 'invoice']

interface CampaignOption {
  id: string
  title: string
  tracker_id: string
}

export interface CloneableDoc {
  id: string
  type: string
  status: string
  document_number: string
  version?: number | null
}

interface CloneDocumentModalProps {
  doc: CloneableDoc
  campaignId: string
  onClose: () => void
}

export default function CloneDocumentModal({ doc, campaignId, onClose }: CloneDocumentModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Target campaign
  const [targetCampaignMode, setTargetCampaignMode] = useState<'same' | 'different'>('same')
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaignId)

  // Target type
  const [targetType, setTargetType] = useState(doc.type)

  // Recognition period
  const [copyRecognition, setCopyRecognition] = useState(true)

  // Load campaigns for cross-campaign cloning
  useEffect(() => {
    if (targetCampaignMode === 'different' && campaigns.length === 0) {
      setCampaignsLoading(true)
      fetch('/api/campaigns/list')
        .then((r) => r.json())
        .then((data: { campaigns?: CampaignOption[] }) => {
          setCampaigns((data.campaigns ?? []).filter((c) => c.id !== campaignId))
        })
        .catch(() => {})
        .finally(() => setCampaignsLoading(false))
    }
  }, [targetCampaignMode, campaigns.length, campaignId])

  function handleConfirm() {
    setError(null)
    const target = targetCampaignMode === 'same' ? campaignId : selectedCampaignId
    if (targetCampaignMode === 'different' && !selectedCampaignId) {
      setError('Please select a target campaign.')
      return
    }
    startTransition(async () => {
      const result = await cloneDocumentAction(doc.id, target, targetType, copyRecognition)
      if (result.error) {
        setError(result.error)
        return
      }
      // Redirect to edit page of the new clone
      const type = result.type
      const newDocId = result.newDocId!
      const newCampaignId = result.campaignId!
      if (type === 'proforma_invoice') {
        router.push(`/campaigns/${newCampaignId}/proforma/${newDocId}/edit`)
      } else if (type === 'invoice') {
        router.push(`/campaigns/${newCampaignId}/invoice/${newDocId}/edit`)
      } else {
        router.push(`/campaigns/${newCampaignId}`)
      }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Clone Document</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Source doc info */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <p className="text-xs text-gray-400 mb-0.5">Cloning</p>
            <p className="font-semibold text-gray-900">{TYPE_LABELS[doc.type] ?? doc.type}</p>
            <p className="text-xs text-gray-400 font-mono">{doc.document_number}</p>
          </div>

          {/* Target campaign */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Target Campaign</label>
            <div className="grid grid-cols-2 gap-2">
              {(['same', 'different'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTargetCampaignMode(mode)
                    if (mode === 'same') setSelectedCampaignId(campaignId)
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    targetCampaignMode === mode
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {mode === 'same' ? 'Same campaign' : 'Different campaign'}
                </button>
              ))}
            </div>

            {targetCampaignMode === 'different' && (
              <div className="pt-1">
                {campaignsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading campaigns…
                  </div>
                ) : (
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
                  >
                    <option value="">— Select campaign —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.tracker_id} — {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Document type */}
          {CLONEABLE_TYPES.includes(doc.type) && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Document Type</label>
              <div className="grid grid-cols-2 gap-2">
                {CLONEABLE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetType(t)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      targetType === t
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recognition period */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="copy-recognition"
              checked={copyRecognition}
              onChange={(e) => setCopyRecognition(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-teal-600"
            />
            <label htmlFor="copy-recognition" className="text-sm text-gray-700">
              Copy recognition period from original
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || (targetCampaignMode === 'different' && !selectedCampaignId)}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#0D9488' }}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Cloning…</>
            ) : (
              <><Copy className="h-4 w-4" />Clone & Edit</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
