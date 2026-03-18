import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { mergeDocumentsIntoPdf, generateWriteOffSummaryBytes, type BundleItem } from '@/lib/pdf/bundle-merge'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  const body = await req.json() as {
    document_ids?: string[]
    order?: string[]
    bundle_type: 'full' | 'custom'
  }

  const supabase = createAdminClient()

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, org_id, tracker_id, title, advertiser, currency, adjustment_write_off, planned_contract_value, compliance_pct, compliance_amount_before_vat')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  let items: BundleItem[] = []

  if (body.bundle_type === 'full' || !body.document_ids) {
    // Fetch all CURRENT documents
    const { data: docs } = await supabase
      .from('documents')
      .select('id, type, status, document_number, file_path, issue_date, amount_before_vat, total_amount')
      .eq('campaign_id', campaignId)
      .eq('status', 'current')
      .order('created_at', { ascending: true })

    // Fetch latest upload record (plan)
    const { data: uploadRecord } = await supabase
      .from('upload_records')
      .select('id, file_name, file_url, file_type, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const docsByType = (type: string) => (docs ?? []).filter((d) => d.type === type)

    // Build items in bundle order: invoices, PO, proforma, plan, compliance_report, write_off_summary
    for (const inv of docsByType('invoice')) {
      items.push({
        docId: inv.id,
        type: 'invoice',
        label: 'Invoice',
        filePath: null,
        fileType: 'generated',
        date: inv.issue_date,
        docNumber: inv.document_number,
      })
    }

    const po = docsByType('purchase_order')[0]
    if (po?.file_path) {
      items.push({
        docId: po.id,
        type: 'purchase_order',
        label: 'Purchase Order',
        filePath: po.file_path,
        fileType: 'pdf',
        date: po.issue_date,
        docNumber: po.document_number,
      })
    }

    const proforma = docsByType('proforma_invoice').slice(-1)[0]
    if (proforma) {
      items.push({
        docId: proforma.id,
        type: 'proforma_invoice',
        label: 'Proforma Invoice',
        filePath: null,
        fileType: 'generated',
        date: proforma.issue_date,
        docNumber: proforma.document_number,
      })
    }

    if (uploadRecord) {
      const ext = uploadRecord.file_name?.split('.').pop()?.toLowerCase() ?? ''
      const isExcel = ['xlsx', 'xls'].includes(ext)
      // Extract file path from file_url if needed
      const filePath = uploadRecord.file_url?.includes('campaign-documents')
        ? new URL(uploadRecord.file_url).pathname.split('/campaign-documents/')[1]?.split('?')[0]
        : null
      items.push({
        docId: null,
        type: 'plan',
        label: 'Media Plan / MPO',
        filePath,
        fileType: isExcel ? 'excel' : 'pdf',
        date: uploadRecord.created_at,
        docNumber: 'PLAN',
      })
    }

    const complianceReport = docsByType('compliance_report')[0]
    if (complianceReport?.file_path) {
      items.push({
        docId: complianceReport.id,
        type: 'compliance_report',
        label: 'Compliance Report',
        filePath: complianceReport.file_path,
        fileType: 'pdf',
        date: complianceReport.issue_date,
        docNumber: complianceReport.document_number,
      })
    }

    // Write-off summary if applicable
    const writeOff = campaign.adjustment_write_off ?? 0
    if (writeOff > 0) {
      items.push({
        docId: null,
        type: 'write_off_summary',
        label: 'Write-Off Summary',
        filePath: null,
        fileType: 'generated',
        date: new Date().toISOString(),
        docNumber: 'WO-SUMMARY',
      })
    }
  } else {
    // Custom bundle — use provided document_ids in order
    const orderedIds = body.order ?? body.document_ids
    const { data: docs } = await supabase
      .from('documents')
      .select('id, type, status, document_number, file_path, issue_date')
      .in('id', body.document_ids)
      .eq('campaign_id', campaignId)

    const docsById = Object.fromEntries((docs ?? []).map((d) => [d.id, d]))

    for (const docId of orderedIds) {
      const doc = docsById[docId]
      if (!doc) continue
      const isGeneratedType = doc.type === 'proforma_invoice' || doc.type === 'invoice'
      items.push({
        docId: doc.id,
        type: doc.type,
        label: doc.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        filePath: isGeneratedType ? null : (doc.file_path ?? null),
        fileType: isGeneratedType ? 'generated' : 'pdf',
        date: doc.issue_date,
        docNumber: doc.document_number,
      })
    }
  }

  // For write_off_summary items, generate the PDF and inject bytes
  const finalItems: BundleItem[] = []
  for (const item of items) {
    if (item.type === 'write_off_summary') {
      // Generate bytes and store temporarily — handle inline in merge
      const writeOffBytes = await generateWriteOffSummaryBytes({
        orgName: '', // will be looked up
        campaign: {
          tracker_id: campaign.tracker_id,
          title: campaign.title,
          advertiser: campaign.advertiser,
          currency: campaign.currency ?? 'NGN',
        },
        plannedValue: campaign.planned_contract_value ?? 0,
        complianceAmount: campaign.compliance_amount_before_vat ?? 0,
        compliancePct: campaign.compliance_pct ?? 0,
        writeOffAmount: campaign.adjustment_write_off ?? 0,
        reportDate: new Date().toISOString(),
      })
      // Store as base64 in a temp storage upload and use as pdf file_path
      const tempPath = `${orgId}/${campaignId}/wo-summary-${Date.now()}.pdf`
      await supabase.storage
        .from('campaign-documents')
        .upload(tempPath, writeOffBytes, { contentType: 'application/pdf', upsert: true })
      finalItems.push({ ...item, filePath: tempPath, fileType: 'pdf' })
    } else {
      finalItems.push(item)
    }
  }

  if (finalItems.length === 0) {
    return NextResponse.json({ error: 'No documents to bundle.' }, { status: 400 })
  }

  // Merge
  let mergedBytes: Uint8Array
  try {
    mergedBytes = await mergeDocumentsIntoPdf(finalItems, orgId, campaignId, supabase)
  } catch (err) {
    console.error('Bundle merge error:', err)
    return NextResponse.json({ error: 'Failed to generate bundle PDF.' }, { status: 500 })
  }

  // Upload merged PDF
  const bundlePath = `${orgId}/${campaignId}/bundle-${Date.now()}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from('campaign-documents')
    .upload(bundlePath, mergedBytes, { contentType: 'application/pdf', upsert: false })

  if (uploadErr) {
    console.error('Bundle upload error:', uploadErr)
    return NextResponse.json({ error: 'Failed to upload bundle.' }, { status: 500 })
  }

  // Create signed URL
  const { data: signedData } = await supabase.storage
    .from('campaign-documents')
    .createSignedUrl(bundlePath, 3600)

  // Insert bundle record
  await supabase.from('document_bundles').insert({
    org_id: orgId,
    campaign_id: campaignId,
    created_by: session.user.id,
    document_ids: finalItems.map((i) => i.docId).filter(Boolean),
    bundle_order: finalItems.map((i) => i.type),
    merged_pdf_url: bundlePath,
    bundle_type: body.bundle_type,
  })

  return NextResponse.json({ download_url: signedData?.signedUrl })
}
