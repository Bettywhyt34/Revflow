import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/data/campaigns'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
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

  const [campaign, orgSettings] = await Promise.all([
    getCampaignById(id, session!.user.orgId),
    getOrgSettingsWithDefaults(session!.user.orgId),
  ])
  if (!campaign) notFound()

  if (campaign.status !== 'plan_submitted') redirect(`/campaigns/${id}`)

  // Client data for pre-filling BILL TO and CC emails
  const client = campaign.client ?? null

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
        clientEmail={client?.email ?? null}
        clientCcEmails={client?.cc_emails ?? []}
        clientName={client?.client_name ?? null}
        clientAddress={client?.address ?? null}
        clientCode={client?.client_code ?? null}
        orgLogoUrl={orgSettings.logo_url}
        primaryColor={orgSettings.primary_color ?? '#0D9488'}
        orgName={orgSettings.org_name ?? 'QVT MEDIA'}
      />
    </div>
  )
}
