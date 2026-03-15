'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
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
}): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  // Insert upload record
  const { error: insertErr } = await supabase.from('upload_records').insert({
    campaign_id: data.campaignId,
    uploader_id: session.user.id,
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

  // Update campaign planned_contract_value
  const { error: updateErr } = await supabase
    .from('campaigns')
    .update({ planned_contract_value: data.confirmedAmountBeforeVat })
    .eq('id', data.campaignId)
    .eq('org_id', orgId)

  if (updateErr) {
    console.error('saveUploadRecord campaign update error:', updateErr)
    return { error: 'Failed to update campaign value.' }
  }

  revalidatePath(`/campaigns/${data.campaignId}`)
  redirect(`/campaigns/${data.campaignId}`)
}
