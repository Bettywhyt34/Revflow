'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export async function voidDocumentAction(
  docId: string,
  reason: string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin') return { error: 'Only admins can void documents.' }

  const supabase = createAdminClient()

  // Verify org ownership via campaign join
  const { data: doc } = await supabase
    .from('documents')
    .select('id, campaign_id, document_number, campaigns!inner(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = (doc.campaigns as unknown) as { org_id: string } | null
  if (!campaign || campaign.org_id !== orgId) return { error: 'Document not found.' }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'void',
      voided_by: userId,
      voided_at: new Date().toISOString(),
      void_reason: reason.trim() || null,
    })
    .eq('id', docId)

  if (updateErr) return { error: 'Failed to void document.' }

  revalidatePath(`/campaigns/${doc.campaign_id}`)
  return {}
}

export async function markDocumentReviewedAction(
  docId: string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, campaign_id, status, campaigns!inner(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = (doc.campaigns as unknown) as { org_id: string } | null
  if (!campaign || campaign.org_id !== orgId) return { error: 'Document not found.' }

  if (doc.status !== 'outdated') return { error: 'Document is not flagged as outdated.' }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'current',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq('id', docId)

  if (updateErr) return { error: 'Failed to mark document as reviewed.' }

  revalidatePath(`/campaigns/${doc.campaign_id}`)
  return {}
}
