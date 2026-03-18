'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notify'

// Legacy action kept for backwards compatibility (FormData signature)
export async function createCampaignAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error: string } | never> {
  const advertiser = (formData.get('advertiser') as string)?.trim()
  const title = (formData.get('title') as string)?.trim()
  const financeExecId = (formData.get('finance_exec_id') as string) || null
  const planReference = (formData.get('plan_reference') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  return createCampaignWithClientAction({
    clientId: null,
    advertiser: advertiser ?? '',
    title: title ?? '',
    financeExecId,
    planReference,
    notes,
  })
}

export async function createCampaignWithClientAction(input: {
  clientId: string | null
  advertiser: string
  title: string
  financeExecId: string | null
  planReference: string | null
  notes: string | null
}): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user?.id || !session.user.orgId) {
    return { error: 'Not authenticated.' }
  }

  const { advertiser, title } = input

  if (!advertiser.trim()) return { error: 'Client name is required.' }
  if (!title.trim()) return { error: 'Campaign name is required.' }

  const supabase = createAdminClient()

  const { data: campaign, error: insertError } = await supabase
    .from('campaigns')
    .insert({
      org_id: session.user.orgId,
      tracker_id: '',
      title: title.trim(),
      advertiser: advertiser.trim(),
      client_id: input.clientId || null,
      plan_reference: input.planReference,
      notes: input.notes,
      account_manager_id: input.financeExecId,
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

  if (input.financeExecId) {
    await notify({
      orgId: session.user.orgId,
      campaignId: campaign.id,
      type: 'approval_required',
      title: 'Campaign Assigned',
      message: `${campaign.tracker_id} — ${title} has been assigned to you.`,
      actionPath: `/campaigns/${campaign.id}`,
      targets: [{ userId: input.financeExecId }],
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
