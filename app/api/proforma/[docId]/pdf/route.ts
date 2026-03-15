import { auth } from '@/lib/auth'
import { getDocumentById } from '@/lib/data/documents'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import ProformaInvoicePDF from '@/components/documents/proforma-pdf'
import type { ProformaInvoiceData, PdfLineItem } from '@/components/documents/proforma-pdf'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function buildSubject(
  invoiceSubject: string | null,
  campaignTitle: string,
  recognitionStart: string | null,
  recognitionEnd: string | null,
): string {
  if (invoiceSubject) return invoiceSubject
  if (recognitionStart && recognitionEnd) {
    return `${campaignTitle} — ${fmtDate(recognitionStart)} to ${fmtDate(recognitionEnd)}`
  }
  return campaignTitle
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { docId } = await params
  const orgId = session.user.orgId

  const [doc, orgSettings] = await Promise.all([
    getDocumentById(docId, orgId),
    getOrgSettingsWithDefaults(orgId),
  ])

  if (!doc) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch client data if available
  let clientCustomerId: string | null = null
  let clientAddress: string | null = null

  if (doc.campaign.client_id) {
    const { data: clientRow } = await createAdminClient()
      .from('clients')
      .select('customer_id, address')
      .eq('id', doc.campaign.client_id)
      .maybeSingle()

    const row = clientRow as { customer_id?: string | null; address?: string | null } | null
    clientCustomerId = row?.customer_id ?? null
    clientAddress = row?.address ?? null
  }

  // Build line items from saved data or derive from amount_before_vat for legacy docs
  let lineItems: PdfLineItem[]
  const savedItems = doc.line_items ?? []
  if (savedItems.length > 0) {
    lineItems = savedItems.map((i) => ({
      qty: i.qty,
      description: i.description,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
    }))
  } else {
    // Legacy: single line from amount_before_vat
    const amt = doc.amount_before_vat ?? 0
    lineItems = amt > 0
      ? [{ qty: 1, description: doc.campaign.title, unitPrice: amt, lineTotal: amt }]
      : []
  }

  const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0)

  const invoiceData: ProformaInvoiceData = {
    orgName: orgSettings.org_name ?? 'QVT MEDIA',
    logoUrl: orgSettings.logo_url,
    primaryColor: orgSettings.primary_color ?? '#0D9488',
    invoiceNumber: doc.document_number,
    issueDate: fmtDate(doc.issue_date),
    recipientName: doc.recipient_name ?? doc.campaign.advertiser,
    recipientAddress: clientAddress,
    customerId: clientCustomerId ?? '—',
    invoiceSubject: buildSubject(
      doc.invoice_subject,
      doc.campaign.title,
      doc.recognition_period_start ?? null,
      doc.recognition_period_end ?? null,
    ),
    currency: doc.currency,
    lineItems,
    subtotal,
    vatAmount: doc.vat_amount ?? 0,
    totalAmount: doc.total_amount ?? 0,
    notes: doc.notes,
  }

  const element = React.createElement(
    ProformaInvoicePDF,
    { data: invoiceData },
  ) as React.ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)
  const uint8 = new Uint8Array(buffer)

  // Store PDF in Supabase Storage and update file_path
  const filePath = `${orgId}/proforma-${docId}.pdf`
  const supabase = createAdminClient()
  await supabase.storage
    .from('campaign-documents')
    .upload(filePath, uint8, { contentType: 'application/pdf', upsert: true })
  await supabase
    .from('documents')
    .update({ file_path: filePath })
    .eq('id', docId)

  const filename = `proforma-${doc.document_number}.pdf`
  return new Response(uint8, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
