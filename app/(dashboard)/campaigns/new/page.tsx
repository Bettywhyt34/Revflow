import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getFinanceExecs } from '@/lib/data/campaigns'
import NewCampaignForm from './new-campaign-form'
import type { UserRole } from '@/types'

export const metadata = { title: 'New Campaign — Revflow' }

export default async function NewCampaignPage() {
  const session = await auth()
  const role = session!.user.role as UserRole

  // Only admin and planner can create campaigns
  if (role !== 'admin' && role !== 'planner') redirect('/campaigns')

  const financeExecs = await getFinanceExecs(session!.user.orgId)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">New Campaign</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a campaign record and assign a Finance Executive
        </p>
      </div>

      <NewCampaignForm financeExecs={financeExecs} />
    </div>
  )
}
