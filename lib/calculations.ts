import { createAdminClient } from '@/lib/supabase/server'

/**
 * Recalculates planned_contract_value and derived metrics for a campaign.
 *
 * Priority rules:
 *  1. Plan + Proforma(s)      → planned_contract_value = SUM of all current proforma amounts
 *  2. Plan + Invoice only     → planned_contract_value = Plan confirmed Amount Before VAT
 *  3. Invoice only            → planned_contract_value = SUM of all current invoice amounts
 *  4. Proforma(s) only        → planned_contract_value = SUM of all current proforma amounts
 *  5. Plan only               → planned_contract_value = Plan confirmed Amount Before VAT
 *
 * Multiple proformas on one campaign (e.g. different billing lines) are summed.
 * Only 'current' status documents count — 'outdated'/'void'/'superseded' are excluded
 * to avoid double-counting revised documents.
 *
 * After updating planned_contract_value, if compliance has already been confirmed,
 * the compliance figures (final_billable, compliance_pct, adjustment_write_off,
 * over_delivery) are recomputed against the new planned value.
 */
export async function recalculateCampaignMetrics(campaignId: string): Promise<void> {
  const supabase = createAdminClient()

  // ── Fetch source documents ────────────────────────────────────────────────

  const [uploadResult, proformaResult, invoiceResult] = await Promise.all([
    // Latest Plan/MPO upload record
    supabase
      .from('upload_records')
      .select('confirmed_amount_before_vat')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // ALL current proformas — summed to support multiple billing lines per campaign
    supabase
      .from('documents')
      .select('amount_before_vat')
      .eq('campaign_id', campaignId)
      .eq('type', 'proforma_invoice')
      .eq('status', 'current'),

    // ALL current invoices — summed to support multiple invoices per campaign
    supabase
      .from('documents')
      .select('amount_before_vat')
      .eq('campaign_id', campaignId)
      .eq('type', 'invoice')
      .eq('status', 'current'),
  ])

  const proformaTotal = (proformaResult.data ?? []).reduce(
    (sum, d) => sum + (d.amount_before_vat ?? 0),
    0,
  )
  const invoiceTotal = (invoiceResult.data ?? []).reduce(
    (sum, d) => sum + (d.amount_before_vat ?? 0),
    0,
  )

  const hasPlan = (uploadResult.data?.confirmed_amount_before_vat ?? 0) > 0
  const hasProforma = proformaTotal > 0
  const hasInvoice = invoiceTotal > 0

  // ── Apply priority rules ──────────────────────────────────────────────────

  let newPlannedValue: number | null = null

  if (hasPlan && hasProforma) {
    // Rule 1: Plan + Proforma(s) → sum of proformas (agreed billing amounts)
    newPlannedValue = proformaTotal
  } else if (hasPlan && !hasProforma && hasInvoice) {
    // Rule 2: Plan + Invoice (no Proforma) → Plan confirmed amount
    newPlannedValue = uploadResult.data!.confirmed_amount_before_vat
  } else if (!hasPlan && !hasProforma && hasInvoice) {
    // Rule 3: Invoice(s) only → sum of invoices
    newPlannedValue = invoiceTotal
  } else if (!hasPlan && hasProforma) {
    // Rule 4: Proforma(s) only → sum of proformas
    newPlannedValue = proformaTotal
  } else if (hasPlan) {
    // Rule 5: Plan only (no proforma or invoice yet) → Plan confirmed amount
    newPlannedValue = uploadResult.data!.confirmed_amount_before_vat
  }

  if (!newPlannedValue || newPlannedValue <= 0) return

  // ── Fetch compliance state ────────────────────────────────────────────────

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('compliance_confirmed_at, compliance_amount_before_vat, planned_contract_value')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) return

  const updates: Record<string, unknown> = {
    planned_contract_value: newPlannedValue,
  }

  // ── Recalculate compliance figures if compliance was already confirmed ─────
  // This keeps compliance_pct / final_billable / write_off consistent
  // if planned_contract_value changes (e.g. proforma sent after plan upload).

  if (campaign.compliance_confirmed_at != null) {
    const complianceAmt = campaign.compliance_amount_before_vat ?? 0
    if (complianceAmt > 0) {
      const overDelivery = complianceAmt > newPlannedValue
      const newFinalBillable = overDelivery ? newPlannedValue : complianceAmt
      const newWriteOff = newPlannedValue - newFinalBillable
      updates.final_billable = newFinalBillable
      updates.compliance_pct = complianceAmt / newPlannedValue
      updates.adjustment_write_off = newWriteOff
      updates.over_delivery = overDelivery
      updates.over_delivery_pct = overDelivery ? complianceAmt / newPlannedValue - 1 : null
    }
  }

  await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
}
