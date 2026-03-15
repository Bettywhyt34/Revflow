'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export async function createCampaignAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user?.id || !session.user.orgId) {
    return { error: 'Not authenticated.' }
  }

  const advertiser = (formData.get('advertiser') as string)?.trim()
  const title = (formData.get('title') as string)?.trim()
  const financeExecId = (formData.get('finance_exec_id') as string) || null
  const planReference = (formData.get('plan_reference') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!advertiser) return { error: 'Client name is required.' }
  if (!title) return { error: 'Campaign name is required.' }

  const supabase = createAdminClient()

  const { data: campaign, error: insertError } = await supabase
    .from('campaigns')
    .insert({
      org_id: session.user.orgId,
      tracker_id: '',          // trigger auto-assigns TRK-XXX
      title,
      advertiser,
      plan_reference: planReference,
      notes,
      account_manager_id: financeExecId,
      status: 'plan_submitted',
      campaign_type: 'direct',
      created_by: session.user.id,
    })
    .select('id, tracker_id')
    .single()

  if (insertError || !campaign) {
    console.error('createCampaign error:', insertError)
    return { error: 'Failed to create campaign. Please try again.' }
  }

  // Notify assigned finance exec
  if (financeExecId) {
    await supabase.from('notifications').insert({
      org_id: session.user.orgId,
      user_id: financeExecId,
      campaign_id: campaign.id,
      type: 'system',
      title: 'Campaign Assigned',
      message: `${campaign.tracker_id} — ${title} has been assigned to you.`,
    })
  }

  revalidatePath('/campaigns')
  redirect(`/campaigns/${campaign.id}`)
}

export async function cancelCampaignAction(campaignId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  // Only admin can cancel
  if (session.user.role !== 'admin') return { error: 'Only admins can cancel campaigns.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled' })
    .eq('id', campaignId)
    .eq('org_id', session.user.orgId)

  if (error) return { error: 'Failed to cancel campaign.' }

  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath('/campaigns')
  return {}
}
