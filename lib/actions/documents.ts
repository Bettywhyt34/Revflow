'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { getNextDocumentNumber } from '@/lib/data/documents'

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

// ── Create New Version ────────────────────────────────────────────────────────
// Creates a new DRAFT version from a CURRENT or OUTDATED document.
// The original is marked SUPERSEDED. The new doc keeps the same document_number.

export async function createVersionAction(
  docId: string,
  editReason?: string,
): Promise<{ error?: string; newDocId?: string; type?: string; campaignId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'finance_exec' && role !== 'planner') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('*, campaigns!inner(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const docCampaign = (doc.campaigns as unknown) as { org_id: string } | null
  if (!docCampaign || docCampaign.org_id !== orgId) return { error: 'Document not found.' }

  if (!['current', 'outdated'].includes(doc.status)) {
    return { error: 'Only CURRENT or OUTDATED documents can be versioned.' }
  }

  const now = new Date().toISOString()

  // Create new DRAFT with incremented version, same document_number
  const { data: newDoc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      campaign_id: doc.campaign_id,
      type: doc.type,
      status: 'draft',
      document_number: doc.document_number,
      version: (doc.version ?? 1) + 1,
      parent_document_id: doc.id,
      edit_reason: editReason?.trim() || null,
      amount_before_vat: doc.amount_before_vat,
      agency_fee_amount: doc.agency_fee_amount,
      vat_amount: doc.vat_amount,
      total_amount: doc.total_amount,
      currency: doc.currency,
      exchange_rate: doc.exchange_rate,
      issue_date: doc.issue_date,
      due_date: doc.due_date,
      recognition_period_start: doc.recognition_period_start,
      recognition_period_end: doc.recognition_period_end,
      recipient_email: doc.recipient_email,
      recipient_name: doc.recipient_name,
      cc_emails: doc.cc_emails ?? [],
      bcc_emails: doc.bcc_emails ?? [],
      subject: doc.subject,
      invoice_subject: doc.invoice_subject,
      notes: doc.notes,
      terms: doc.terms,
      line_items: doc.line_items ?? [],
      file_path: doc.file_path,
      template_id: doc.template_id,
      created_by: userId,
    })
    .select('id, type, campaign_id')
    .single()

  if (insertErr) return { error: 'Failed to create new version.' }

  // Mark original as SUPERSEDED
  await supabase
    .from('documents')
    .update({ status: 'superseded', superseded_at: now, superseded_by: userId })
    .eq('id', docId)

  revalidatePath(`/campaigns/${doc.campaign_id}`)
  return { newDocId: newDoc.id, type: newDoc.type, campaignId: newDoc.campaign_id }
}

// ── Clone Document ─────────────────────────────────────────────────────────────
// Creates a fresh DRAFT clone with a new document number.

export async function cloneDocumentAction(
  docId: string,
  targetCampaignId: string,
  targetType?: string,
  copyRecognitionPeriod = false,
): Promise<{ error?: string; newDocId?: string; type?: string; campaignId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'finance_exec' && role !== 'planner') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('*, campaigns!inner(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const docCampaign = (doc.campaigns as unknown) as { org_id: string } | null
  if (!docCampaign || docCampaign.org_id !== orgId) return { error: 'Document not found.' }

  const { data: targetCampaign } = await supabase
    .from('campaigns')
    .select('id, org_id, currency')
    .eq('id', targetCampaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!targetCampaign) return { error: 'Target campaign not found.' }

  const cloneType = targetType ?? doc.type
  const cloneDocNumber = await getNextDocumentNumber(orgId, cloneType)

  const { data: newDoc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      campaign_id: targetCampaignId,
      type: cloneType,
      status: 'draft',
      document_number: cloneDocNumber,
      version: 1,
      cloned_from_id: doc.id,
      amount_before_vat: doc.amount_before_vat,
      agency_fee_amount: doc.agency_fee_amount,
      vat_amount: doc.vat_amount,
      total_amount: doc.total_amount,
      currency: (targetCampaign as { currency?: string }).currency ?? doc.currency,
      exchange_rate: doc.exchange_rate,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: doc.due_date,
      recognition_period_start: copyRecognitionPeriod ? doc.recognition_period_start : null,
      recognition_period_end: copyRecognitionPeriod ? doc.recognition_period_end : null,
      recipient_email: doc.recipient_email,
      recipient_name: doc.recipient_name,
      cc_emails: doc.cc_emails ?? [],
      invoice_subject: doc.invoice_subject,
      notes: doc.notes,
      terms: doc.terms,
      line_items: doc.line_items ?? [],
      template_id: doc.template_id,
      created_by: userId,
    })
    .select('id, type, campaign_id')
    .single()

  if (insertErr) return { error: 'Failed to clone document.' }

  revalidatePath(`/campaigns/${targetCampaignId}`)
  if (targetCampaignId !== doc.campaign_id) revalidatePath(`/campaigns/${doc.campaign_id}`)

  return { newDocId: newDoc.id, type: newDoc.type, campaignId: newDoc.campaign_id }
}
