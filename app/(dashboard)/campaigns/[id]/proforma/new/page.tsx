import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/data/campaigns'
import type { UserRole } from '@/types'
import ProformaForm from './proforma-form'

export async function generateMetadata() {
  return { title: 'Create Proforma — Revflow' }
}

export default async function NewProformaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const role = session!.user.role as UserRole

  if (role !== 'admin' && role !== 'planner') redirect(`/campaigns/${id}`)

  const campaign = await getCampaignById(id, session!.user.orgId)
  if (!campaign) notFound()

  if (campaign.status !== 'plan_submitted') redirect(`/campaigns/${id}`)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <ProformaForm
        campaignId={id}
        campaign={{
          title: campaign.title,
          advertiser: campaign.advertiser,
          agency_name: campaign.agency_name,
          campaign_type: campaign.campaign_type,
          agency_fee_pct: campaign.agency_fee_pct,
          currency: campaign.currency,
          tracker_id: campaign.tracker_id,
          planned_contract_value: campaign.planned_contract_value,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
        }}
      />
    </div>
  )
}
