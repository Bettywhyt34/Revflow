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
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { docId } = await params
  const orgId = session.user.orgId

  const [doc, orgSettings] = await Promise.all([
    getDocumentById(docId, orgId),
    getOrgSettingsWithDefaults(orgId),
  ])

  if (!doc) return new Response('Not found', { status: 404 })
  if (doc.type !== 'invoice') return new Response('Not found', { status: 404 })

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

  let lineItems: PdfLineItem[]
  const savedItems = doc.line_items ?? []
  if (savedItems.length > 0) {
    lineItems = savedItems.map((i) => ({
      qty: i.qty, description: i.description, unitPrice: i.unit_price, lineTotal: i.line_total,
    }))
  } else {
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
    documentTitle: 'TAX INVOICE',
    invoiceNumber: doc.document_number,
    issueDate: fmtDate(doc.issue_date),
    recipientName: doc.recipient_name ?? doc.campaign.advertiser,
    recipientAddress: clientAddress,
    customerId: clientCustomerId ?? '—',
    invoiceSubject: doc.invoice_subject ?? doc.campaign.title,
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

  const filePath = `${orgId}/invoice-${docId}.pdf`
  const supabase = createAdminClient()
  await supabase.storage
    .from('campaign-documents')
    .upload(filePath, uint8, { contentType: 'application/pdf', upsert: true })
  await supabase.from('documents').update({ file_path: filePath }).eq('id', docId)

  const filename = `invoice-${doc.document_number}.pdf`
  return new Response(uint8, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
