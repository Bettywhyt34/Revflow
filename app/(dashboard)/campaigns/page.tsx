import { auth } from '@/lib/auth'
import { getCampaigns, getFinanceExecs } from '@/lib/data/campaigns'
import CampaignTable from '@/components/campaigns/campaign-table'
import type { UserRole } from '@/types'

export const metadata = { title: 'Campaigns — Revflow' }

export default async function CampaignsPage() {
  const session = await auth()
  const orgId = session!.user.orgId

  const [campaigns, financeExecs] = await Promise.all([
    getCampaigns(orgId),
    getFinanceExecs(orgId),
  ])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-500">
          All active and historical campaign billing records
        </p>
      </div>

      <CampaignTable
        campaigns={campaigns}
        financeExecs={financeExecs}
        userRole={session!.user.role as UserRole}
      />
    </div>
  )
}
