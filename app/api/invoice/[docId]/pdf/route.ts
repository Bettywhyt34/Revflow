import { auth } from '@/lib/auth'
import { getDocumentById } from '@/lib/data/documents'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import ProformaInvoicePDF from '@/components/documents/proforma-pdf'
import type { ProformaInvoiceData, PdfLineItem } from '@/components/documents/proforma-pdf'
import TemplateT2PDF from '@/components/documents/template-t2-pdf'
import TemplateT3PDF from '@/components/documents/template-t3-pdf'
import type { DocumentTemplateData } from '@/components/documents/template-types'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function paymentTermsLabel(terms: string | null): string {
  if (!terms) return 'Net 30'
  return terms
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
  const templateId = (doc as { template_id?: string }).template_id ?? '1'

  // Derive payment terms label from stored terms string
  const termsStr = (doc as { terms?: string | null }).terms ?? null
  const paymentTerms = termsStr
    ? termsStr.replace(/^Payment due within (\d+) days.*$/, 'Net $1').replace('Net 0', 'Due on Receipt')
    : 'Net 30'

  // Fetch PO number from campaign
  const { data: campaignRow } = await createAdminClient()
    .from('campaigns')
    .select('po_number')
    .eq('id', doc.campaign.id ?? doc.campaign.title)
    .maybeSingle()
  const poNumber = (campaignRow as { po_number?: string | null } | null)?.po_number ?? null

  let element: React.ReactElement<DocumentProps>

  if (templateId === '2' || templateId === '3') {
    const templateData: DocumentTemplateData = {
      orgName: orgSettings.org_name ?? 'QVT MEDIA',
      orgAddress: orgSettings.address ?? null,
      logoUrl: orgSettings.logo_url,
      primaryColor: orgSettings.primary_color ?? '#0D9488',
      documentType: 'invoice',
      documentTitle: 'INVOICE',
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
      dueDate: fmtDate(doc.due_date),
      paymentTerms: paymentTermsLabel(paymentTerms),
      poNumber,
      balanceDue: doc.total_amount ?? 0,
    }
    const Component = templateId === '3' ? TemplateT3PDF : TemplateT2PDF
    element = React.createElement(Component, { data: templateData }) as React.ReactElement<DocumentProps>
  } else {
    // Template 1 — QVT Classic
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
    element = React.createElement(
      ProformaInvoicePDF,
      { data: invoiceData },
    ) as React.ReactElement<DocumentProps>
  }

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
