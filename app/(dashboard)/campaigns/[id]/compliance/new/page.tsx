import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/data/campaigns'
import type { UserRole } from '@/types'
import ComplianceUploadClient from './compliance-upload-client'

export async function generateMetadata() {
  return { title: 'Upload Compliance — Revflow' }
}

export default async function ComplianceUploadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const role = session!.user.role as UserRole

  if (role !== 'admin' && role !== 'compliance' && role !== 'finance_exec') {
    redirect(`/campaigns/${id}`)
  }

  const campaign = await getCampaignById(id, session!.user.orgId)
  if (!campaign) notFound()

  const allowedStatuses = ['invoice_sent', 'partially_paid', 'fully_paid', 'compliance_uploaded']
  if (!allowedStatuses.includes(campaign.status)) {
    redirect(`/campaigns/${id}`)
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <ComplianceUploadClient
        campaignId={id}
        trackerID={campaign.tracker_id}
        campaignTitle={campaign.title}
        advertiser={campaign.advertiser}
        plannedValue={campaign.planned_contract_value}
        currency={campaign.currency ?? 'NGN'}
        alreadyUploaded={campaign.status === 'compliance_uploaded'}
        existingCompliancePct={campaign.compliance_pct}
        existingFinalBillable={campaign.final_billable}
      />
    </div>
  )
}
