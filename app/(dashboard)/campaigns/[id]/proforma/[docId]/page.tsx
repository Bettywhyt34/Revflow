import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle, Download } from 'lucide-react'
import { getDocumentById, getDocumentVersionHistory } from '@/lib/data/documents'
import { getOrgBankAccounts, getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase'
import type { UserRole } from '@/types'
import { toWords } from 'number-to-words'
import ProformaHTMLPreview from '@/components/documents/proforma-html-preview'
import type { SavedLineItem } from '@/lib/data/documents'
import DocActions from './doc-actions'

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
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
  const isSuperseded = doc.status === 'superseded'
  const isVoid = doc.status === 'void'
  const canSend = role === 'admin' || role === 'finance_exec'
  const canEdit = ['admin', 'finance_exec'].includes(role)

  const [bankAccounts, orgSettings, clientRow, versionHistory] = await Promise.all([
    getOrgBankAccounts(orgId),
    getOrgSettingsWithDefaults(orgId),
    campaign.client_id
      ? createAdminClient()
          .from('clients')
          .select('preferred_bank_account_id, customer_id, address')
          .eq('id', campaign.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getDocumentVersionHistory(doc.document_number),
  ])

  const rawClient = clientRow.data as {
    preferred_bank_account_id?: string | null
    customer_id?: string | null
    address?: string | null
  } | null

  const clientPreferredBankAccountId = rawClient?.preferred_bank_account_id ?? null
  const clientCustomerId = rawClient?.customer_id ?? null
  const clientAddress = rawClient?.address ?? null

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
        ? [{ qty: 1, description: campaign.title, unitPrice: doc.amount_before_vat ?? 0, lineTotal: doc.amount_before_vat ?? 0 }]
        : []

  const customerId = clientCustomerId ?? campaign.tracker_id ?? '—'
  const amountInWords = toNairaWords(doc.total_amount ?? 0)

  const hasMultipleVersions = versionHistory.length > 1

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6 overflow-x-hidden">
      {/* Back nav */}
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaign
      </Link>

      {/* Status banner */}
      {isSuperseded ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          Read-only — this is a superseded version. A newer version exists.
        </div>
      ) : isVoid ? (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          This document has been voided.{doc.void_reason ? ` Reason: ${doc.void_reason}` : ''}
        </div>
      ) : isSent ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          Sent to {doc.recipient_email} on {fmtDateTime(doc.sent_at)}
          {(doc.version ?? 1) > 1 && <span className="ml-2 text-[11px] text-green-600">v{doc.version}</span>}
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
      <DocActions
        docId={docId}
        campaignId={id}
        docType={doc.type}
        docStatus={doc.status}
        documentNumber={doc.document_number}
        docVersion={doc.version ?? 1}
        role={role}
        canSend={canSend}
        canEdit={canEdit}
        isDraft={isDraft}
        isSent={isSent}
        recipientEmail={doc.recipient_email}
        recipientName={doc.recipient_name}
        ccEmails={Array.isArray(doc.cc_emails) ? doc.cc_emails as string[] : []}
        bankAccounts={bankAccounts}
        clientPreferredBankAccountId={clientPreferredBankAccountId}
        campaignTitle={campaign.title}
        clientName={campaign.advertiser}
        pdfHref={`/api/proforma/${docId}/pdf`}
      />

      {/* Version History */}
      {hasMultipleVersions && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            Version History
            <span className="text-xs text-gray-400 font-normal">— {versionHistory.length} versions</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Version</th>
                  <th className="pb-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="pb-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="pb-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((v) => {
                  const isCurrentView = v.id === docId
                  const statusColors: Record<string, string> = {
                    draft: 'text-blue-700',
                    current: 'text-green-700',
                    superseded: 'text-gray-400',
                    void: 'text-red-600',
                    outdated: 'text-amber-700',
                  }
                  return (
                    <tr key={v.id} className={`border-b border-gray-50 ${isCurrentView ? 'bg-teal-50/40' : ''}`}>
                      <td className="py-2.5 text-gray-900 font-medium">
                        v{v.version ?? 1}
                        {isCurrentView && <span className="ml-1.5 text-[10px] text-teal-600">(viewing)</span>}
                      </td>
                      <td className={`py-2.5 text-xs font-semibold uppercase ${statusColors[v.status] ?? 'text-gray-500'}`}>
                        {v.status}
                      </td>
                      <td className="py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                        {fmtDate(v.issue_date ?? v.created_at)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {!isCurrentView && (
                            <Link
                              href={`/campaigns/${id}/proforma/${v.id}`}
                              className="text-xs text-[#0D9488] hover:underline min-h-[28px] flex items-center"
                            >
                              View
                            </Link>
                          )}
                          <a
                            href={`/api/proforma/${v.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 min-h-[28px]"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
