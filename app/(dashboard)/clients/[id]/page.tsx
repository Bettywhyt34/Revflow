import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getClientById, getClientCampaigns } from '@/lib/data/clients'
import type { UserRole } from '@/types'
import ClientDetailClient from './client-detail-client'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: 'Client — Revflow' }
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const orgId = session!.user.orgId
  const role = session!.user.role as UserRole

  const [client, { campaigns, totalBilled, totalCollected }] = await Promise.all([
    getClientById(id, orgId),
    getClientCampaigns(id, orgId),
  ])

  if (!client) notFound()

  const balance = totalBilled - totalCollected
  const canEdit = role === 'admin' || role === 'planner' || role === 'finance_exec'

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Campaigns', value: String(campaigns.length) },
          { label: 'Total Billed', value: totalBilled > 0 ? fmtCurrency(totalBilled) : '—' },
          { label: 'Collected', value: totalCollected > 0 ? fmtCurrency(totalCollected) : '—' },
          { label: 'Balance', value: balance > 0 ? fmtCurrency(balance) : '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className="text-xl font-bold text-gray-900 truncate">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Edit form */}
        <div className="lg:col-span-2">
          <ClientDetailClient client={client} canEdit={canEdit} />
        </div>

        {/* Campaigns list */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Campaigns ({campaigns.length})
          </h2>
          {campaigns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">No campaigns yet for this client.</p>
              <Link
                href="/campaigns/new"
                className="mt-2 inline-block text-sm font-medium hover:underline"
                style={{ color: '#0D9488' }}
              >
                Create a campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100
                    px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold" style={{ color: '#0D9488' }}>
                        {campaign.tracker_id}
                      </span>
                      <StatusDot status={campaign.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
                      {campaign.title}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {campaign.planned_contract_value != null && (
                      <p className="text-sm font-semibold text-gray-700">
                        {fmtCurrency(campaign.planned_contract_value)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(campaign.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-300',
    plan_submitted: 'bg-blue-400',
    proforma_sent: 'bg-teal-400',
    po_received: 'bg-cyan-400',
    invoice_sent: 'bg-amber-400',
    partially_paid: 'bg-orange-400',
    fully_paid: 'bg-green-400',
    compliance_uploaded: 'bg-purple-400',
    closed: 'bg-gray-400',
    cancelled: 'bg-red-400',
  }
  const label = status.replace(/_/g, ' ')
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />
      {label}
    </span>
  )
}
