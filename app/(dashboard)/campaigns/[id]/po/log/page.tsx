import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/data/campaigns'
import type { UserRole } from '@/types'
import PoForm from './po-form'

export async function generateMetadata() {
  return { title: 'Log PO Received — Revflow' }
}

export default async function LogPoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const role = session!.user.role as UserRole

  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') {
    redirect(`/campaigns/${id}`)
  }

  const campaign = await getCampaignById(id, session!.user.orgId)
  if (!campaign) notFound()

  if (campaign.status !== 'proforma_sent') redirect(`/campaigns/${id}`)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <PoForm
        campaignId={id}
        trackerID={campaign.tracker_id}
        campaignTitle={campaign.title}
        currency={campaign.currency}
        plannedValue={campaign.planned_contract_value}
      />
    </div>
  )
}
