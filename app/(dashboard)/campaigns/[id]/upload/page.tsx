import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCampaignById } from '@/lib/data/campaigns'
import { getLatestUploadRecord } from '@/lib/data/documents'
import UploadClient from './upload-client'
import type { UserRole } from '@/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Upload Plan — Revflow` }
}

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const role = session!.user.role as UserRole

  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') redirect(`/campaigns/${id}`)

  const [campaign, uploadRecord] = await Promise.all([
    getCampaignById(id, session!.user.orgId),
    getLatestUploadRecord(id),
  ])
  if (!campaign) notFound()

  if (campaign.status === 'closed' || campaign.status === 'cancelled') redirect(`/campaigns/${id}`)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <UploadClient
        campaignId={id}
        trackerID={campaign.tracker_id}
        campaignTitle={campaign.title}
        advertiser={campaign.advertiser}
        userRole={role}
        isUpdate={!!uploadRecord}
      />
    </div>
  )
}
