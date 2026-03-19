import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCampaigns } from '@/lib/data/campaigns'
import { getFilterOptions } from '@/lib/data/dashboard'
import type { UserRole } from '@/types'
import FilterSelect from '../filter-select'

export const metadata = { title: 'Campaign Report — Revflow' }

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const STATUS_LABELS: Record<string, string> = {
  plan_submitted: 'Plan Submitted',
  proforma_sent: 'Proforma Sent',
  po_received: 'PO Received',
  invoice_sent: 'Invoice Sent',
  partially_paid: 'Partly Paid',
  fully_paid: 'Fully Paid',
  compliance_uploaded: 'Compliance',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
}

const STATUS_COLORS: Record<string, string> = {
  plan_submitted: 'bg-blue-100 text-blue-700',
  proforma_sent: 'bg-yellow-100 text-yellow-700',
  po_received: 'bg-orange-100 text-orange-700',
  invoice_sent: 'bg-purple-100 text-purple-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  fully_paid: 'bg-green-100 text-green-700',
  compliance_uploaded: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-gray-100 text-gray-500',
  on_hold: 'bg-gray-100 text-gray-500',
}

export default async function CampaignsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; exec?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = session.user.role as UserRole
  if (userRole !== 'admin' && userRole !== 'finance_exec') redirect('/dashboard')

  const orgId = session.user.orgId ?? ''
  const { status: statusParam, client: clientParam, exec: execParam } = await searchParams

  const [campaigns, filterOptions] = await Promise.all([
    getCampaigns(orgId),
    getFilterOptions(orgId),
  ])

  // Apply filters
  const filtered = campaigns.filter((c) => {
    if (statusParam && statusParam !== 'all' && c.status !== statusParam) return false
    if (clientParam && clientParam !== 'all' && c.client_id !== clientParam) return false
    if (execParam && execParam !== 'all' && c.account_manager_id !== execParam) return false
    return true
  })

  // Unique statuses in data
  const statuses = [...new Set(campaigns.map((c) => c.status))]

  const exportParams = new URLSearchParams()
  if (statusParam) exportParams.set('status', statusParam)
  if (clientParam) exportParams.set('client', clientParam)
  if (execParam) exportParams.set('exec', execParam)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/reports" className="hover:text-teal-600 transition-colors">Reports</Link>
            <span>/</span>
            <span className="text-gray-600">Campaign Report</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} campaigns</p>
        </div>
        <a
          href={`/api/reports/campaigns/export?${exportParams.toString()}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          Export Excel
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          name="status"
          defaultValue={statusParam ?? ''}
          placeholder="All Statuses"
          options={statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
        />
        {filterOptions.clients.length > 0 && (
          <FilterSelect
            name="client"
            defaultValue={clientParam ?? ''}
            placeholder="All Clients"
            options={filterOptions.clients.map((cl) => ({ value: cl.id, label: cl.client_name }))}
          />
        )}
        {filterOptions.financeExecs.length > 0 && (
          <FilterSelect
            name="exec"
            defaultValue={execParam ?? ''}
            placeholder="All Execs"
            options={filterOptions.financeExecs.map((ex) => ({ value: ex.id, label: ex.full_name }))}
          />
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No campaigns match the selected filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Tracker</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Advertiser</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Planned</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Final Billable</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Write-Off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-mono text-xs text-teal-600 hover:underline font-semibold"
                      >
                        {c.tracker_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {c.client?.client_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.advertiser}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">
                      {formatCurrency(c.planned_contract_value ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden lg:table-cell">
                      {c.final_billable != null ? formatCurrency(c.final_billable) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">
                      {(c.adjustment_write_off ?? 0) > 0 ? formatCurrency(c.adjustment_write_off ?? 0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">
                    {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 hidden sm:table-cell">
                    {formatCurrency(filtered.reduce((s, c) => s + (c.planned_contract_value ?? 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 hidden lg:table-cell">
                    {formatCurrency(filtered.reduce((s, c) => s + (c.final_billable ?? c.planned_contract_value ?? 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">
                    {formatCurrency(filtered.reduce((s, c) => s + (c.adjustment_write_off ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
