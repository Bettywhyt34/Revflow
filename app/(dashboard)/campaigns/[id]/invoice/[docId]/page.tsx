import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle, Download } from 'lucide-react'
import { getDocumentById } from '@/lib/data/documents'
import { getOrgBankAccounts, getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase'
import type { UserRole, OrgBankAccount } from '@/types'
import InvoiceSendButton from './send-button'

function fmt(amount: number | null, currency = 'NGN'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; docId: string }> }) {
  void (await params)
  return { title: `Invoice — Revflow` }
}

export default async function ViewInvoicePage({
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
  if (doc.type !== 'invoice') notFound()

  const campaign = doc.campaign
  const isSent = !!doc.sent_at
  const isDraft = doc.status === 'draft'
  const canSend = role === 'admin' || role === 'finance_exec'
  const showAgencyFee = (doc.agency_fee_amount ?? 0) > 0

  const [bankAccounts, orgSettings, clientRow] = await Promise.all([
    getOrgBankAccounts(orgId),
    getOrgSettingsWithDefaults(orgId),
    campaign.client_id
      ? createAdminClient()
          .from('clients')
          .select('preferred_bank_account_id')
          .eq('id', campaign.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const clientPreferredBankAccountId =
    (clientRow.data as { preferred_bank_account_id?: string | null } | null)
      ?.preferred_bank_account_id ?? null

  let displayBankAccount: OrgBankAccount | null = null
  if (clientPreferredBankAccountId) {
    displayBankAccount = bankAccounts.find((a) => a.id === clientPreferredBankAccountId) ?? null
  }
  if (!displayBankAccount) {
    displayBankAccount = bankAccounts.find((a) => a.is_default) ?? bankAccounts[0] ?? null
  }

  const pc = orgSettings.primary_color ?? '#0D9488'

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <Link
        href={`/campaigns/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaign
      </Link>

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

      {/* Invoice document */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 flex flex-col sm:flex-row sm:justify-between gap-4 items-start">
          <div>
            {orgSettings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={orgSettings.logo_url} alt={orgSettings.org_name ?? 'Logo'} className="h-12 max-w-[160px] object-contain mb-1" />
            ) : (
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: pc }}>
                {orgSettings.org_name ?? 'QVT MEDIA'}
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-lg font-bold" style={{ color: '#1a1a4e' }}>TAX INVOICE</div>
            <div className="text-sm mt-1 font-semibold" style={{ color: pc }}>{doc.document_number}</div>
            <div className="text-xs text-gray-500 mt-1">
              Date: {fmtDate(doc.issue_date)}<br />
              Due: {fmtDate(doc.due_date)}
            </div>
          </div>
        </div>
        <div className="mx-8 mb-0" style={{ height: 2, backgroundColor: pc }} />

        <div className="px-8 py-7 space-y-6">
          {/* Bill To */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bill To</div>
              <div className="font-bold text-gray-900 text-base">{doc.recipient_name ?? campaign.advertiser}</div>
              {doc.recipient_email && <div className="text-sm text-gray-500 mt-0.5">{doc.recipient_email}</div>}
            </div>
            <div className="sm:text-right">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recognition Period</div>
              <div className="text-sm font-semibold" style={{ color: pc }}>
                {doc.recognition_period_start && doc.recognition_period_end
                  ? `${fmtDate(doc.recognition_period_start)} – ${fmtDate(doc.recognition_period_end)}`
                  : '— not set —'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-0.5">RE: Ref {campaign.tracker_id}</div>
            <div className="font-bold text-gray-900 text-lg">{campaign.title}</div>
          </div>

          {/* Line items */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(doc.line_items ?? []).length > 0
                ? doc.line_items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3.5 text-gray-400 text-sm">{item.qty}</td>
                      <td className="py-3.5 text-gray-700">{item.description}</td>
                      <td className="py-3.5 text-right font-medium text-gray-800">
                        {fmt(item.line_total, doc.currency)}
                      </td>
                    </tr>
                  ))
                : (
                    <tr className="border-b border-gray-100">
                      <td className="py-3.5 text-gray-400 text-sm">1</td>
                      <td className="py-3.5 text-gray-700">{campaign.title}</td>
                      <td className="py-3.5 text-right font-medium text-gray-800">
                        {fmt(doc.amount_before_vat, doc.currency)}
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <table className="w-72 text-sm border-collapse">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-500">Subtotal</td>
                  <td className="py-2 text-right text-gray-700">{fmt(doc.amount_before_vat, doc.currency)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">VAT @ 7.5%</td>
                  <td className="py-2 text-right text-gray-700">{fmt(doc.vat_amount, doc.currency)}</td>
                </tr>
                <tr className="border-t-2" style={{ borderColor: pc }}>
                  <td className="pt-3 font-bold text-gray-900 text-base">Total Due</td>
                  <td className="pt-3 text-right font-bold text-gray-900 text-base">{fmt(doc.total_amount, doc.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {doc.due_date && (
            <div className="rounded-lg px-5 py-3" style={{ backgroundColor: pc + '18', border: `1px solid ${pc}40` }}>
              <span className="text-sm font-semibold" style={{ color: pc }}>
                Payment due by {fmtDate(doc.due_date)}
              </span>
            </div>
          )}

          {doc.notes && (
            <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600 rounded-r-lg border-l-4" style={{ borderColor: pc }}>
              <span className="font-semibold">Notes:</span> {doc.notes}
            </div>
          )}

          {/* Bank details */}
          <div className="bg-gray-50 rounded-xl px-5 py-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Details</div>
            {displayBankAccount ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-gray-400">Bank</dt>
                <dd className="font-medium text-gray-700">{displayBankAccount.bank_name}</dd>
                <dt className="text-gray-400">Account Name</dt>
                <dd className="font-medium text-gray-700">{displayBankAccount.account_name}</dd>
                <dt className="text-gray-400">Account Number</dt>
                <dd className="font-medium text-gray-700">{displayBankAccount.account_number}</dd>
                {displayBankAccount.bank_code && (
                  <>
                    <dt className="text-gray-400">Sort Code</dt>
                    <dd className="font-medium text-gray-700">{displayBankAccount.bank_code}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">Not configured — add bank accounts in Settings → Documents.</p>
            )}
          </div>

          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            For enquiries: billing@revflowapp.com
          </p>
        </div>
      </div>

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
            href={`/api/invoice/${docId}/pdf`}
            download={`invoice-${doc.document_number}.pdf`}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5
              rounded-lg text-sm font-medium border border-gray-200 text-gray-700
              hover:bg-gray-50 transition"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <InvoiceSendButton
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
