'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { getNextDocumentNumber } from '@/lib/data/documents'

const MISMATCH_THRESHOLD_PCT = 5

export interface LogPoInput {
  campaignId: string
  poNumber: string       // client's PO reference
  poDate: string         // YYYY-MM-DD
  poAmount: number | null
  filePath: string | null
  fileUrl: string | null
  fileName: string | null
  fileSizeBytes: number | null
  notes: string
}

export async function logPoReceivedAction(
  input: LogPoInput,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status, planned_contract_value, currency, tracker_id, title, org_id')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }
  if (campaign.status !== 'proforma_sent') {
    return { error: 'Campaign must be in "Proforma Sent" status to log a PO.' }
  }

  // ── Optional: save PO document record ──────────────────────────────────
  if (input.filePath && input.fileUrl && input.fileName) {
    const docNumber = await getNextDocumentNumber(orgId, 'purchase_order')
    const { error: docErr } = await supabase.from('documents').insert({
      campaign_id: input.campaignId,
      type: 'purchase_order',
      status: 'current',
      document_number: docNumber,
      version: 1,
      amount_before_vat: input.poAmount,
      total_amount: input.poAmount,
      currency: campaign.currency ?? 'NGN',
      exchange_rate: 1,
      issue_date: input.poDate,
      file_url: input.fileUrl,
      file_path: input.filePath,
      recipient_name: campaign.title,
      notes: input.notes
        ? `PO Ref: ${input.poNumber}. ${input.notes}`
        : `PO Ref: ${input.poNumber}`,
      created_by: session.user.id,
    })
    if (docErr) {
      console.error('PO document insert error:', docErr)
      return { error: 'Failed to save PO document record.' }
    }
  }

  // ── Advance campaign status ─────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('campaigns')
    .update({
      status: 'po_received',
      po_received_date: input.poDate,
      po_number: input.poNumber,
      po_amount: input.poAmount,
    })
    .eq('id', input.campaignId)
    .eq('org_id', orgId)

  if (updateErr) {
    console.error('Campaign PO update error:', updateErr)
    return { error: 'Failed to update campaign.' }
  }

  // ── Value mismatch check ────────────────────────────────────────────────
  if (
    input.poAmount != null &&
    campaign.planned_contract_value != null &&
    campaign.planned_contract_value > 0
  ) {
    const diffPct =
      (Math.abs(input.poAmount - campaign.planned_contract_value) /
        campaign.planned_contract_value) *
      100

    if (diffPct > MISMATCH_THRESHOLD_PCT) {
      await supabase.from('value_mismatch_log').insert({
        campaign_id: input.campaignId,
        field_name: 'po_amount_vs_planned',
        expected_value: String(campaign.planned_contract_value),
        actual_value: String(input.poAmount),
        status: 'open',
        notes: `PO amount (${input.poAmount}) differs from planned contract value (${campaign.planned_contract_value}) by ${diffPct.toFixed(1)}%.`,
      })
    }
  }

  // ── Notify finance execs ────────────────────────────────────────────────
  const { data: financeExecs } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'finance_exec')

  const notifBase = {
    org_id: orgId,
    campaign_id: input.campaignId,
    type: 'approval_required' as const,
    title: `PO received — ${campaign.tracker_id}`,
    message: `PO ${input.poNumber} received for "${campaign.title}". Ready to raise invoice.`,
  }

  const notifs = [
    // Individual notifications for each finance exec
    ...(financeExecs ?? []).map((u) => ({ ...notifBase, user_id: u.id })),
    // Org-wide broadcast
    { ...notifBase, user_id: null },
  ]

  await supabase.from('notifications').insert(notifs)

  // ── Auto-post journal entries if invoice already exists ──────────────────
  const { data: invDocs } = await supabase
    .from('documents')
    .select('id, amount_before_vat, agency_fee_amount, total_amount')
    .eq('campaign_id', input.campaignId)
    .eq('type', 'invoice')
    .limit(1)

  if (invDocs?.[0]) {
    const inv = invDocs[0]
    const baseEntry = {
      org_id: orgId,
      campaign_id: input.campaignId,
      document_id: inv.id,
      source_app: 'revflow',
      transaction_date: input.poDate,
      created_by: session.user.id,
      reference: `PO-${input.poNumber}`,
    }
    await supabase.from('journal_entries').insert([
      { ...baseEntry, account_code: '1100', debit: inv.total_amount ?? 0,        credit: 0,                           description: 'AR raised on PO receipt' },
      { ...baseEntry, account_code: '4000', debit: 0,                            credit: inv.amount_before_vat ?? 0,  description: 'Revenue recognised' },
      ...((inv.agency_fee_amount ?? 0) > 0 ? [
        { ...baseEntry, account_code: '4100', debit: 0,                          credit: inv.agency_fee_amount ?? 0,  description: 'Agency fee recognised' },
      ] : []),
    ])
  }

  revalidatePath(`/campaigns/${input.campaignId}`)
  return { ok: true as const }
}
