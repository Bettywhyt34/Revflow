import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle, Download } from 'lucide-react'
import { getDocumentById } from '@/lib/data/documents'
import { getOrgBankAccounts, getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase'
import type { UserRole } from '@/types'
import { toWords } from 'number-to-words'
import ProformaHTMLPreview from '@/components/documents/proforma-html-preview'
import type { SavedLineItem } from '@/lib/data/documents'
import SendProformaButton from './send-button'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toNairaWords(amount: number): string {
  if (amount <= 0) return '—'
  const naira = Math.floor(amount)
  const kobo = Math.round((amount - naira) * 100)
  let result = toWords(naira).toUpperCase() + ' NAIRA'
  if (kobo > 0) result += ', ' + toWords(kobo).toUpperCase() + ' KOBO'
  return result + ' ONLY'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { docId } = await params
  void docId
  return { title: `Proforma — Revflow` }
}

export default async function ViewProformaPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { id, docId } = await params
  const session = await auth()
  const role = session!.user.role as UserRole
  const orgId = session!.user.orgId

  const doc = await getDocumentById(docId, orgId)
  if (!doc) notFound()
  if (doc.campaign.id !== id) notFound()

  const campaign = doc.campaign
  const isSent = !!doc.sent_at
  const isDraft = doc.status === 'draft'
  const canSend = role === 'admin' || role === 'planner'

  const [bankAccounts, orgSettings, clientRow] = await Promise.all([
    getOrgBankAccounts(orgId),
    getOrgSettingsWithDefaults(orgId),
    campaign.client_id
      ? createAdminClient()
          .from('clients')
          .select('preferred_bank_account_id, customer_id, address')
          .eq('id', campaign.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const rawClient = clientRow.data as {
    preferred_bank_account_id?: string | null
    customer_id?: string | null
    address?: string | null
  } | null

  const clientPreferredBankAccountId = rawClient?.preferred_bank_account_id ?? null
  const clientCustomerId = rawClient?.customer_id ?? null
  const clientAddress = rawClient?.address ?? null

  // Build line items
  const savedItems = (doc.line_items ?? []) as SavedLineItem[]
  const lineItems =
    savedItems.length > 0
      ? savedItems.map((i) => ({
          qty: i.qty,
          description: i.description,
          unitPrice: i.unit_price,
          lineTotal: i.line_total,
        }))
      : (doc.amount_before_vat ?? 0) > 0
        ? [
            {
              qty: 1,
              description: campaign.title,
              unitPrice: doc.amount_before_vat ?? 0,
              lineTotal: doc.amount_before_vat ?? 0,
            },
          ]
        : []

  const customerId = clientCustomerId ?? campaign.tracker_id ?? '—'
  const amountInWords = toNairaWords(doc.total_amount ?? 0)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Back nav */}
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaign
      </Link>

      {/* Status banner */}
      {isSent ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          Sent to {doc.recipient_email} on {fmtDateTime(doc.sent_at)}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Mail className="h-4 w-4 flex-shrink-0" />
          Draft — not yet sent
        </div>
      )}

      {/* Proforma document */}
      <ProformaHTMLPreview
        orgName={orgSettings.org_name ?? 'QVT MEDIA'}
        orgLogoUrl={orgSettings.logo_url}
        primaryColor={orgSettings.primary_color ?? '#0D9488'}
        invoiceNumber={doc.document_number}
        issueDate={fmtDate(doc.issue_date)}
        recipientName={doc.recipient_name ?? campaign.advertiser}
        recipientAddress={clientAddress}
        customerId={customerId}
        invoiceSubject={doc.invoice_subject ?? campaign.title}
        currency={doc.currency}
        lineItems={lineItems}
        vatAmount={doc.vat_amount ?? 0}
        totalAmount={doc.total_amount ?? 0}
        amountInWords={amountInWords}
        notes={doc.notes}
      />

      {/* Action buttons */}
      {canSend && (
        <div className="flex justify-end gap-3 flex-wrap">
          <Link
            href={`/campaigns/${id}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5
              rounded-lg text-sm font-medium border border-gray-300 text-gray-700
              hover:bg-gray-50 transition"
          >
            Back to Campaign
          </Link>
          <a
            href={`/api/proforma/${docId}/pdf`}
            download={`proforma-${doc.document_number}.pdf`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5
              rounded-lg text-sm font-medium border border-gray-200 text-gray-700
              hover:bg-gray-50 transition"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <SendProformaButton
            docId={docId}
            campaignId={id}
            isSent={isSent}
            isDraft={isDraft}
            documentNumber={doc.document_number}
            documentType={doc.type}
            campaignTitle={campaign.title}
            clientName={campaign.advertiser}
            recipientEmail={doc.recipient_email}
            recipientName={doc.recipient_name}
            ccEmails={Array.isArray(doc.cc_emails) ? doc.cc_emails : []}
            bankAccounts={bankAccounts}
            clientPreferredBankAccountId={clientPreferredBankAccountId}
          />
        </div>
      )}
    </div>
  )
}
