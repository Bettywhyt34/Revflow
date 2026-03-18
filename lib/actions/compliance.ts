'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyRole } from '@/lib/notify'
import type { DetectionConfidence, ExtractionMethod } from '@/types'

export interface ConfirmComplianceInput {
  campaignId: string
  complianceAmount: number
  filePath: string
  fileUrl: string
  fileName: string
  fileSizeBytes: number
  fileType: string
  extractionMethod: ExtractionMethod
  detectedAmount: number | null
  confidence: DetectionConfidence
  extractionResult: object
}

export async function confirmComplianceAction(
  input: ConfirmComplianceInput,
): Promise<{ error?: string; reportDocumentId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'compliance' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  // Fetch campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select(
      'id, org_id, tracker_id, title, advertiser, planned_contract_value, currency, status, client_id, start_date, end_date',
    )
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }

  const planAmount = campaign.planned_contract_value ?? 0
  if (planAmount <= 0) {
    return { error: 'Planned contract value is not set. Upload the plan first.' }
  }

  // Calculate compliance figures
  const compliancePct = input.complianceAmount / planAmount
  const overDelivery = input.complianceAmount > planAmount
  const overDeliveryPct = overDelivery ? compliancePct - 1 : 0
  const finalBillable = overDelivery ? planAmount : input.complianceAmount
  const writeOff = planAmount - finalBillable

  // 1. Save upload record
  await supabase.from('upload_records').insert({
    campaign_id: input.campaignId,
    uploader_id: userId,
    file_name: input.fileName,
    file_url: input.fileUrl,
    file_type: input.fileType,
    file_size_bytes: input.fileSizeBytes,
    status: 'processed',
    detected_amount_before_vat: input.detectedAmount,
    confirmed_amount_before_vat: input.complianceAmount,
    detection_confidence: input.confidence,
    extraction_result: input.extractionResult,
    extraction_method: input.extractionMethod,
  })

  // 2. Get document number for compliance doc
  const { data: docNumData } = await supabase.rpc('next_document_number', {
    p_org_id: orgId,
    p_type: 'compliance',
  })
  const complianceDocNumber = (docNumData as string) ?? `COMP-${Date.now()}`

  // 3. Insert compliance document record
  const { data: complianceDoc } = await supabase
    .from('documents')
    .insert({
      campaign_id: input.campaignId,
      type: 'compliance',
      status: 'current',
      document_number: complianceDocNumber,
      version: 1,
      amount_before_vat: input.complianceAmount,
      total_amount: input.complianceAmount,
      currency: campaign.currency ?? 'NGN',
      exchange_rate: 1,
      issue_date: new Date().toISOString().split('T')[0],
      file_url: input.fileUrl,
      file_path: input.filePath,
      notes: `Compliance % = ${(compliancePct * 100).toFixed(2)}%`,
      created_by: userId,
    })
    .select('id')
    .single()

  // 4. Generate compliance report PDF and store it
  let reportDocumentId: string | undefined
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const React = await import('react')
    const { ComplianceReportDocument } = await import('@/lib/pdf/compliance-report')

    // Fetch confirmed user name
    const { data: confirmedUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()

    // Fetch org name
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    const reportData = {
      orgName: org?.name ?? 'QVT Media',
      campaign: {
        tracker_id: campaign.tracker_id,
        title: campaign.title,
        advertiser: campaign.advertiser,
        currency: campaign.currency ?? 'NGN',
        start_date: campaign.start_date,
        end_date: campaign.end_date,
      },
      planAmount,
      complianceAmount: input.complianceAmount,
      compliancePct,
      finalBillable,
      writeOff,
      overDelivery,
      overDeliveryPct,
      confirmedByName: confirmedUser?.full_name ?? 'System',
      confirmedAt: new Date().toISOString(),
      reportDate: new Date().toISOString(),
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(ComplianceReportDocument, { data: reportData }) as React.ReactElement<import('@react-pdf/renderer').DocumentProps>,
    )

    const reportFilePath = `${orgId}/${input.campaignId}/compliance-report-${Date.now()}.pdf`
    await supabase.storage
      .from('campaign-documents')
      .upload(reportFilePath, pdfBuffer, { contentType: 'application/pdf', upsert: false })

    const { data: signedReport } = await supabase.storage
      .from('campaign-documents')
      .createSignedUrl(reportFilePath, 3600)

    // Insert report document record
    const { data: reportDocNumData } = await supabase.rpc('next_document_number', {
      p_org_id: orgId,
      p_type: 'compliance_report',
    })
    const reportDocNumber = (reportDocNumData as string) ?? `CR-${Date.now()}`

    const { data: reportDoc } = await supabase
      .from('documents')
      .insert({
        campaign_id: input.campaignId,
        type: 'compliance_report',
        status: 'current',
        document_number: reportDocNumber,
        version: 1,
        amount_before_vat: finalBillable,
        total_amount: finalBillable,
        currency: campaign.currency ?? 'NGN',
        exchange_rate: 1,
        issue_date: new Date().toISOString().split('T')[0],
        file_url: signedReport?.signedUrl ?? '',
        file_path: reportFilePath,
        notes: 'Auto-generated compliance report',
        created_by: userId,
      })
      .select('id')
      .single()

    reportDocumentId = reportDoc?.id
  } catch (pdfErr) {
    console.error('Compliance PDF generation error:', pdfErr)
    // Non-fatal — continue without PDF
  }

  // 5. Write-off journal entry if applicable
  if (writeOff > 0) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('journal_entries').insert([
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: complianceDoc?.id ?? null,
        transaction_date: today,
        account_code: '6900',
        description: `Write-off — ${campaign.tracker_id}`,
        debit: writeOff,
        credit: 0,
        source_app: 'revflow',
        created_by: userId,
      },
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: complianceDoc?.id ?? null,
        transaction_date: today,
        account_code: '1100',
        description: `AR reduced — write-off ${campaign.tracker_id}`,
        debit: 0,
        credit: writeOff,
        source_app: 'revflow',
        created_by: userId,
      },
    ])
  }

  // 6. Update campaign
  await supabase
    .from('campaigns')
    .update({
      compliance_amount_before_vat: input.complianceAmount,
      compliance_pct: compliancePct,
      final_billable: finalBillable,
      adjustment_write_off: writeOff,
      over_delivery: overDelivery,
      over_delivery_pct: overDelivery ? overDeliveryPct : null,
      compliance_confirmed_by: userId,
      compliance_confirmed_at: new Date().toISOString(),
      status: 'compliance_uploaded',
    })
    .eq('id', input.campaignId)
    .eq('org_id', orgId)

  // 7. Notifications
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: campaign.currency ?? 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const pctStr = `${(compliancePct * 100).toFixed(1)}%`
  const complianceMsg = `Compliance %: ${pctStr}. Final Billable: ${fmt(finalBillable)}.${writeOff > 0 ? ` Write-Off: ${fmt(writeOff)}` : ''}`
  const complianceTitle = `Compliance confirmed — ${campaign.tracker_id}`
  const actionPath = `/campaigns/${input.campaignId}`

  await notifyRole(orgId, 'finance_exec', {
    campaignId: input.campaignId,
    type: 'compliance',
    title: complianceTitle,
    message: complianceMsg,
    actionPath,
  })
  await notifyRole(orgId, 'admin', {
    campaignId: input.campaignId,
    type: 'compliance',
    title: complianceTitle,
    message: complianceMsg,
    actionPath,
  })

  if (writeOff > 0) {
    await notifyRole(orgId, 'admin', {
      campaignId: input.campaignId,
      type: 'compliance',
      title: `Write-off — ${campaign.tracker_id}`,
      message: `Write-off of ${fmt(writeOff)} on ${campaign.title} (${campaign.advertiser})`,
      actionPath,
    })
  }

  revalidatePath(`/campaigns/${input.campaignId}`)
  revalidatePath('/campaigns')

  return { reportDocumentId }
}

export interface RaiseDisputeInput {
  campaignId: string
  reason: string
  disputedAmount: number
  originalAmount: number
  notes?: string
}

export async function raiseDisputeAction(
  input: RaiseDisputeInput,
): Promise<{ error?: string; disputeId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'compliance' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, tracker_id, title')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }

  const { data: dispute, error: dispErr } = await supabase
    .from('compliance_disputes')
    .insert({
      org_id: orgId,
      campaign_id: input.campaignId,
      raised_by: userId,
      reason: input.reason.trim(),
      disputed_amount: input.disputedAmount,
      original_amount: input.originalAmount,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (dispErr || !dispute) return { error: 'Failed to raise dispute.' }

  await supabase
    .from('campaigns')
    .update({
      compliance_disputed: true,
      compliance_dispute_reason: input.reason.trim(),
      compliance_dispute_raised_by: userId,
    })
    .eq('id', input.campaignId)
    .eq('org_id', orgId)

  // Notify finance execs + admins
  const disputeMsg = `Dispute on compliance for ${campaign.title}. Review required. Reason: ${input.reason.trim()}`
  const disputeTitle = `Dispute raised — ${campaign.tracker_id}`
  const disputePath = `/campaigns/${input.campaignId}`
  await notifyRole(orgId, 'admin', {
    campaignId: input.campaignId,
    type: 'compliance',
    title: disputeTitle,
    message: disputeMsg,
    actionPath: disputePath,
  })
  await notifyRole(orgId, 'finance_exec', {
    campaignId: input.campaignId,
    type: 'compliance',
    title: disputeTitle,
    message: disputeMsg,
    actionPath: disputePath,
  })

  revalidatePath(`/campaigns/${input.campaignId}`)
  return { disputeId: dispute.id }
}

export interface ResolveDisputeInput {
  disputeId: string
  campaignId: string
  agreedAmount: number
}

export async function resolveDisputeAction(
  input: ResolveDisputeInput,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return { error: 'Only admin or finance_exec can resolve disputes.' }
  }

  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, planned_contract_value, currency, tracker_id')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }

  // Update dispute
  const updateFields: Record<string, unknown> = {
    agreed_amount: input.agreedAmount,
    resolved_at: new Date().toISOString(),
  }
  if (role === 'finance_exec') updateFields.finance_exec_approved = true
  if (role === 'admin') {
    updateFields.finance_exec_approved = true
    updateFields.admin_approved = true
  }

  await supabase
    .from('compliance_disputes')
    .update(updateFields)
    .eq('id', input.disputeId)
    .eq('campaign_id', input.campaignId)

  // If admin resolved (both approved), update campaign compliance
  if (role === 'admin') {
    const planAmount = campaign.planned_contract_value ?? 0
    const compliancePct = planAmount > 0 ? input.agreedAmount / planAmount : 0
    const overDelivery = input.agreedAmount > planAmount
    const finalBillable = overDelivery ? planAmount : input.agreedAmount
    const writeOff = planAmount - finalBillable

    await supabase
      .from('campaigns')
      .update({
        compliance_amount_before_vat: input.agreedAmount,
        compliance_pct: compliancePct,
        final_billable: finalBillable,
        adjustment_write_off: writeOff,
        over_delivery: overDelivery,
        compliance_disputed: false,
        compliance_confirmed_by: userId,
        compliance_confirmed_at: new Date().toISOString(),
        status: 'compliance_uploaded',
      })
      .eq('id', input.campaignId)
      .eq('org_id', orgId)

    if (writeOff > 0) {
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('journal_entries').insert([
        {
          org_id: orgId,
          campaign_id: input.campaignId,
          transaction_date: today,
          account_code: '6900',
          description: `Write-off (disputed) — ${campaign.tracker_id}`,
          debit: writeOff,
          credit: 0,
          source_app: 'revflow',
          created_by: userId,
        },
        {
          org_id: orgId,
          campaign_id: input.campaignId,
          transaction_date: today,
          account_code: '1100',
          description: `AR reduced (disputed) — ${campaign.tracker_id}`,
          debit: 0,
          credit: writeOff,
          source_app: 'revflow',
          created_by: userId,
        },
      ])
    }

    const resolvedMsg = `Agreed amount: ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: campaign.currency ?? 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(input.agreedAmount)}`
    await notifyRole(orgId, 'admin', {
      campaignId: input.campaignId,
      type: 'compliance',
      title: `Dispute resolved — ${campaign.tracker_id}`,
      message: resolvedMsg,
      actionPath: `/campaigns/${input.campaignId}`,
    })
    await notifyRole(orgId, 'finance_exec', {
      campaignId: input.campaignId,
      type: 'compliance',
      title: `Dispute resolved — ${campaign.tracker_id}`,
      message: resolvedMsg,
      actionPath: `/campaigns/${input.campaignId}`,
    })
  }

  revalidatePath(`/campaigns/${input.campaignId}`)
  return {}
}
