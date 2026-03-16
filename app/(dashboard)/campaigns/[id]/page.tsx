import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import {
  getCampaignById,
  getCampaignNotifications,
} from '@/lib/data/campaigns'
import { getDocumentsByCampaign, getLatestUploadRecord } from '@/lib/data/documents'
import {
  getPaymentsByCampaign,
  getCampaignCashTotal,
  getCampaignWhtTotal,
  getCampaignTotalSettled,
} from '@/lib/data/payments'
import StatusBadge from '@/components/campaigns/status-badge'
import NextActionBadge from '@/components/campaigns/next-action-badge'
import { ArrowLeft, Calendar, User, FileText, Bell, ClipboardCheck, AlertTriangle, Download, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { CampaignStatus, UserRole } from '@/types'
import CampaignActions from './campaign-actions'
import PaymentHistory from './payment-history'
import DocumentBundle from './document-bundle'
import type { InvoiceOption } from './payment-log-modal'

function formatCurrency(value: number | null, currency = 'NGN'): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Key figures ───────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'amber'
}) {
  const colors = {
    green: 'text-green-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold truncate ${highlight ? colors[highlight] : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Notification icon by type ─────────────────────────────────────────────────
function notifDot(type: string): string {
  const map: Record<string, string> = {
    invoice_due: 'bg-amber-400',
    payment_received: 'bg-green-400',
    approval_required: 'bg-blue-400',
    chase: 'bg-orange-400',
    system: 'bg-teal-400',
    compliance: 'bg-purple-400',
  }
  return map[type] ?? 'bg-gray-300'
}

// ── Page ──────────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const campaign = await getCampaignById(id, session!.user.orgId)
  return {
    title: campaign ? `${campaign.tracker_id} — Revflow` : 'Campaign — Revflow',
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const orgId = session!.user.orgId
  const userRole = session!.user.role as UserRole

  const [campaign, notifications, documents, payments, totalCash, totalWht, totalSettled, uploadRecord] =
    await Promise.all([
      getCampaignById(id, orgId),
      getCampaignNotifications(id),
      getDocumentsByCampaign(id),
      getPaymentsByCampaign(id, orgId),
      getCampaignCashTotal(id),
      getCampaignWhtTotal(id),
      getCampaignTotalSettled(id),
      getLatestUploadRecord(id),
    ])

  if (!campaign) notFound()

  const status = campaign.status as CampaignStatus
  const plannedValue = campaign.planned_contract_value
  const poDoc = documents.find((d) => d.type === 'purchase_order') ?? null
  // Use compliance final_billable if compliance has been uploaded, otherwise planned value
  const finalBillable = campaign.final_billable ?? plannedValue
  const balance = finalBillable != null ? finalBillable - totalSettled : null
  const compliancePct = campaign.compliance_pct
  const writeOff = campaign.adjustment_write_off ?? 0
  const complianceUploaded = status === 'compliance_uploaded' || status === 'closed'
  const complianceReportDoc = documents.find((d) => d.type === 'compliance_report') ?? null

  // Invoices for payment modal
  const invoiceDocs = documents.filter((d) => d.type === 'invoice' && d.status === 'current')
  const currentInvoices: InvoiceOption[] = invoiceDocs.map((d) => ({
    id: d.id,
    document_number: d.document_number,
    total_amount: d.total_amount,
    amount_before_vat: d.amount_before_vat ?? null,
    outstanding: d.total_amount != null ? Math.max(0, d.total_amount - totalSettled) : null,
  }))

  // Client WHT profile
  const clientWhtApplicable = campaign.client?.wht_applicable ?? true
  const clientWhtType = campaign.client?.wht_type ?? 'agency_fee'
  const clientWhtRate = campaign.client?.wht_rate ?? 0.05

  const totalInvoiced = invoiceDocs.reduce((sum, d) => sum + (d.total_amount ?? 0), 0)

  // Finance visibility: Planner and Compliance cannot see financial figures
  const canViewFinancials = userRole === 'admin' || userRole === 'finance_exec'

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 overflow-x-hidden">
      {/* Back nav */}
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Campaigns
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            {/* Tracker + status row */}
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono text-sm font-bold text-[#0D9488]">
                {campaign.tracker_id}
              </span>
              <StatusBadge status={status} />
              <NextActionBadge status={status} />
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {campaign.title}
            </h1>
            <p className="text-base text-gray-500 font-medium">{campaign.advertiser}</p>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-400">
              {campaign.account_manager && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {campaign.account_manager.full_name}
                </span>
              )}
              {campaign.plan_reference && (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {campaign.plan_reference}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Created {formatDate(campaign.created_at)}
              </span>
              {campaign.po_number && (
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  PO: {campaign.po_number}
                  {campaign.po_received_date && (
                    <span className="text-gray-300">· {formatDate(campaign.po_received_date)}</span>
                  )}
                </span>
              )}
            </div>

            {/* PO value mismatch warning — financial roles only */}
            {canViewFinancials && campaign.po_amount != null &&
              campaign.planned_contract_value != null &&
              campaign.planned_contract_value > 0 &&
              Math.abs(campaign.po_amount - campaign.planned_contract_value) /
                campaign.planned_contract_value > 0.05 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  PO amount ({formatCurrency(campaign.po_amount, campaign.currency)}) differs
                  from planned value ({formatCurrency(campaign.planned_contract_value, campaign.currency)})
                </div>
              )}
          </div>

          {/* Action buttons */}
          <CampaignActions
            campaignId={campaign.id}
            status={status}
            userRole={userRole}
            trackerID={campaign.tracker_id}
            campaignTitle={campaign.title}
            currency={campaign.currency ?? 'NGN'}
            plannedValue={campaign.planned_contract_value}
            currentInvoices={currentInvoices}
            balanceOutstanding={balance}
            clientWhtApplicable={clientWhtApplicable}
            clientWhtType={clientWhtType}
            clientWhtRate={clientWhtRate}
          />
        </div>
      </div>

      {/* PO Details card */}
      {campaign.po_number && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">PO Details</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">PO Number</dt>
                  <dd className="font-semibold text-gray-900">{campaign.po_number}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Date</dt>
                  <dd className="text-gray-900">{formatDate(campaign.po_received_date)}</dd>
                </div>
                {canViewFinancials && (
                  <div>
                    <dt className="text-xs text-gray-400">Amount</dt>
                    <dd className="text-gray-900">{formatCurrency(campaign.po_amount, campaign.currency)}</dd>
                  </div>
                )}
              </dl>
            </div>
            {poDoc?.file_path && (
              <a
                href={`/api/documents/${poDoc.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg
                  border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex-shrink-0"
              >
                <Download className="h-4 w-4" />
                Download PO
              </a>
            )}
          </div>
        </div>
      )}

      {/* KPI bar — financial roles only */}
      {canViewFinancials && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard
            label="Planned Value"
            value={formatCurrency(plannedValue, campaign.currency)}
          />
          <KpiCard
            label="Final Billable"
            value={formatCurrency(finalBillable, campaign.currency)}
            sub={complianceUploaded ? `${compliancePct != null ? (compliancePct * 100).toFixed(1) + '% compliance' : 'After compliance'}` : 'After compliance'}
            highlight={complianceUploaded && compliancePct != null ? (compliancePct >= 0.9 ? 'green' : compliancePct >= 0.7 ? 'amber' : 'red') : undefined}
          />
          <KpiCard
            label="Total Invoiced"
            value={formatCurrency(totalInvoiced || null, campaign.currency)}
          />
          <KpiCard
            label="Cash Received"
            value={formatCurrency(totalCash || null, campaign.currency)}
            highlight={totalCash > 0 ? 'green' : undefined}
          />
          <KpiCard
            label="WHT Credits"
            value={formatCurrency(totalWht || null, campaign.currency)}
            highlight={totalWht > 0 ? 'amber' : undefined}
          />
          <KpiCard
            label="Total Settled"
            value={formatCurrency(totalSettled || null, campaign.currency)}
            highlight={totalSettled > 0 ? 'green' : undefined}
          />
          <KpiCard
            label="Balance"
            value={formatCurrency(balance, campaign.currency)}
            sub="Outstanding"
            highlight={balance != null ? (balance <= 0 ? 'green' : 'red') : undefined}
          />
        </div>
      )}

      {/* Compliance details card */}
      {complianceUploaded && campaign.compliance_amount_before_vat != null && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                {campaign.compliance_disputed ? (
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                )}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Compliance Details
                </p>
                {campaign.compliance_disputed && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                    Disputed
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Plan Amount</dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(plannedValue, campaign.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Compliance Amount</dt>
                  <dd className="font-semibold text-gray-900">{formatCurrency(campaign.compliance_amount_before_vat, campaign.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Compliance %</dt>
                  <dd className={`font-bold flex items-center gap-1 ${
                    compliancePct != null && compliancePct >= 0.9 ? 'text-green-600'
                    : compliancePct != null && compliancePct >= 0.7 ? 'text-amber-600'
                    : 'text-red-600'
                  }`}>
                    {compliancePct != null ? (
                      <>
                        {compliancePct >= 1 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {(compliancePct * 100).toFixed(2)}%
                      </>
                    ) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Write-Off</dt>
                  <dd className={`font-semibold ${writeOff > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {writeOff > 0 ? formatCurrency(writeOff, campaign.currency) : '—'}
                  </dd>
                </div>
              </dl>
              {campaign.over_delivery && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 w-fit">
                  <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                  Over-delivery: {campaign.over_delivery_pct != null ? `${(campaign.over_delivery_pct * 100).toFixed(2)}%` : ''} above plan. Final Billable capped at Planned Value.
                </div>
              )}
              {campaign.compliance_disputed && campaign.compliance_dispute_reason && (
                <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span><strong>Dispute reason:</strong> {campaign.compliance_dispute_reason}</span>
                </div>
              )}
            </div>
            {complianceReportDoc?.file_path && (
              <a
                href={`/api/documents/${complianceReportDoc.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex-shrink-0"
              >
                <Download className="h-4 w-4" />
                Compliance Report
              </a>
            )}
          </div>
        </div>
      )}

      {/* Payment history — financial roles only */}
      {canViewFinancials && payments.length > 0 && (
        <PaymentHistory
          payments={payments}
          finalBillable={finalBillable}
          currency={campaign.currency ?? 'NGN'}
          campaignId={id}
          userRole={userRole}
          onRefresh={() => {}}
        />
      )}

      {/* Lower grid — documents + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Document bundle */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <DocumentBundle
            documents={documents}
            uploadRecord={uploadRecord}
            campaignId={id}
            orgId={orgId}
            userRole={userRole}
            currency={campaign.currency ?? 'NGN'}
            writeOff={writeOff}
          />
          {documents.length === 0 && !uploadRecord && status === 'plan_submitted' && (
            <div className="mt-3 text-center">
              <Link
                href={`/campaigns/${id}/proforma/new`}
                className="text-xs font-medium hover:underline"
                style={{ color: '#0D9488' }}
              >
                + Create Proforma
              </Link>
            </div>
          )}
        </div>

        {/* Activity timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-400" />
            Activity
          </h2>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-gray-400">No activity yet</p>
            </div>
          ) : (
            <ol className="relative border-l border-gray-100 ml-2 space-y-4">
              {notifications.map((n) => (
                <li key={n.id} className="ml-4">
                  <span
                    className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white ${notifDot(n.type)}`}
                  />
                  <p className="text-xs font-semibold text-gray-700">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <time className="text-[10px] text-gray-300">{formatDateTime(n.created_at)}</time>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Notes (if any) */}
      {campaign.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{campaign.notes}</p>
        </div>
      )}
    </div>
  )
}
