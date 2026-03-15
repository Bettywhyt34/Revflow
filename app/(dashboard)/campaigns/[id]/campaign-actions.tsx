'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelCampaignAction } from '@/lib/actions/campaigns'
import type { CampaignStatus, UserRole } from '@/types'

// Maps status → primary CTA button (future steps will make these functional)
function primaryAction(
  status: CampaignStatus,
  role: UserRole,
  campaignId: string,
): { label: string; href: string } | null {
  if (role === 'admin' || role === 'planner') {
    if (status === 'plan_submitted')
      return { label: 'Create Proforma', href: `/campaigns/${campaignId}/proforma/new` }
  }
  if (role === 'admin' || role === 'finance_exec') {
    if (status === 'po_received')
      return { label: 'Raise Invoice', href: `/campaigns/${campaignId}/invoice/new` }
    if (status === 'invoice_sent' || status === 'partially_paid')
      return { label: 'Log Payment', href: `/campaigns/${campaignId}/payment/new` }
    if (status === 'fully_paid')
      return { label: 'Upload Compliance', href: `/campaigns/${campaignId}/compliance/new` }
    if (status === 'compliance_uploaded')
      return { label: 'Review & Close', href: `/campaigns/${campaignId}/close` }
  }
  if (role === 'compliance') {
    if (status === 'fully_paid')
      return { label: 'Upload Compliance', href: `/campaigns/${campaignId}/compliance/new` }
  }
  return null
}

export default function CampaignActions({
  campaignId,
  status,
  userRole,
}: {
  campaignId: string
  status: CampaignStatus
  userRole: UserRole
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const cta = primaryAction(status, userRole, campaignId)
  const canCancel =
    userRole === 'admin' && status !== 'closed' && status !== 'cancelled'

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelCampaignAction(campaignId)
      if (result.error) {
        setError(result.error)
      } else {
        setShowConfirm(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end flex-shrink-0">
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition whitespace-nowrap"
          style={{ background: '#0D9488' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
        >
          {cta.label}
        </Link>
      )}

      {canCancel && !showConfirm && (
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 transition whitespace-nowrap"
        >
          Cancel Campaign
        </button>
      )}

      {showConfirm && (
        <div className="flex flex-col gap-2 text-right">
          <p className="text-xs text-gray-500">Are you sure?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="min-h-[44px] px-4 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              No
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="min-h-[44px] px-4 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-60"
            >
              {isPending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
