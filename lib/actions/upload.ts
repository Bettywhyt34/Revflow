'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { notify, notifyRole } from '@/lib/notify'
import { recalculateCampaignMetrics } from '@/lib/calculations'
import type { DetectionConfidence, ExtractionMethod } from '@/types'

export async function saveUploadRecordAction(data: {
  campaignId: string
  filePath: string
  fileUrl: string
  fileName: string
  fileSizeBytes: number
  fileType: string
  extractionMethod: ExtractionMethod
  detectedAmountBeforeVat: number | null
  confirmedAmountBeforeVat: number
  detectionConfidence: DetectionConfidence
  extractionResult: object
  adminOverride?: boolean
  adminOverrideReason?: string
}): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  // ── Re-upload guard ──────────────────────────────────────────────────────────
  const { count: existingCount } = await supabase
    .from('upload_records')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', data.campaignId)

  const isReUpload = (existingCount ?? 0) > 0

  if (isReUpload) {
    // Check for existing payments
    const { count: paymentCount } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', data.campaignId)

    const hasPayments = (paymentCount ?? 0) > 0

    if (hasPayments && !data.adminOverride) {
      return { error: 'BLOCKED_BY_PAYMENTS' }
    }

    if (hasPayments && data.adminOverride) {
      // Log override notification to admins + finance_exec
      const overrideMsg = `Plan re-uploaded by admin with payments present. Reason: ${data.adminOverrideReason ?? 'No reason provided'}.`
      await notifyRole(orgId, 'admin', {
        campaignId: data.campaignId,
        type: 'system',
        title: 'Plan re-uploaded (admin override)',
        message: overrideMsg,
        actionPath: `/campaigns/${data.campaignId}`,
      })
      await notifyRole(orgId, 'finance_exec', {
        campaignId: data.campaignId,
        type: 'system',
        title: 'Plan re-uploaded (admin override)',
        message: overrideMsg,
        actionPath: `/campaigns/${data.campaignId}`,
      })
    }

    // Flag CURRENT/DRAFT proforma_invoice and invoice docs as OUTDATED
    const { data: docsToOutdate } = await supabase
      .from('documents')
      .select('id')
      .eq('campaign_id', data.campaignId)
      .in('type', ['proforma_invoice', 'invoice'])
      .in('status', ['current', 'draft'])

    if (docsToOutdate && docsToOutdate.length > 0) {
      await supabase
        .from('documents')
        .update({ status: 'outdated' })
        .in('id', docsToOutdate.map((d) => d.id))

      // Notify finance_exec + admin about OUTDATED docs
      const outdatedMsg = `Plan re-uploaded. ${docsToOutdate.length} document(s) flagged OUTDATED. Review required.`
      await notifyRole(orgId, 'admin', {
        campaignId: data.campaignId,
        type: 'system',
        title: 'Plan updated — documents flagged OUTDATED',
        message: outdatedMsg,
        actionPath: `/campaigns/${data.campaignId}`,
      })
      await notifyRole(orgId, 'finance_exec', {
        campaignId: data.campaignId,
        type: 'system',
        title: 'Plan updated — documents flagged OUTDATED',
        message: outdatedMsg,
        actionPath: `/campaigns/${data.campaignId}`,
      })
    }
  }

  // ── Insert upload record ─────────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from('upload_records').insert({
    campaign_id: data.campaignId,
    uploader_id: userId,
    file_name: data.fileName,
    file_url: data.fileUrl,
    file_type: data.fileType,
    file_size_bytes: data.fileSizeBytes,
    status: 'processed',
    detected_amount_before_vat: data.detectedAmountBeforeVat,
    confirmed_amount_before_vat: data.confirmedAmountBeforeVat,
    detection_confidence: data.detectionConfidence,
    extraction_result: data.extractionResult,
    extraction_method: data.extractionMethod,
  })

  if (insertErr) {
    console.error('saveUploadRecord insert error:', insertErr)
    return { error: 'Failed to save upload record.' }
  }

  // Recalculate planned_contract_value using priority rules
  // (proforma takes priority over plan if both exist)
  await recalculateCampaignMetrics(data.campaignId)

  revalidatePath(`/campaigns/${data.campaignId}`)
  redirect(`/campaigns/${data.campaignId}`)
}
