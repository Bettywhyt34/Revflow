import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getWhtCredits } from '@/lib/data/payments'
import type { UserRole } from '@/types'

function formatCurrency(value: number | null, currency = 'NGN'): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  utilised: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
}

const WHT_TYPE_LABELS: Record<string, string> = {
  agency_fee: 'Agency Fee',
  general_services: 'General Services',
  supply_goods: 'Supply of Goods',
  rent: 'Rent',
  dividend: 'Dividend/Interest',
  exempt: 'Exempt',
  custom: 'Custom',
}

export const metadata = { title: 'WHT Credits — Revflow' }

export default async function WhtCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = session.user.role as UserRole
  if (userRole !== 'admin' && userRole !== 'finance_exec') {
    redirect('/dashboard')
  }

  const orgId = session.user.orgId
  const { year: yearParam, status: statusParam } = await searchParams

  const allCredits = await getWhtCredits(orgId)

  // Filter
  const filtered = allCredits.filter((c) => {
    if (yearParam && String(c.tax_year) !== yearParam) return false
    if (statusParam && statusParam !== 'all' && c.status !== statusParam) return false
    return true
  })

  const totalAvailable = allCredits
    .filter((c) => c.status === 'available')
    .reduce((sum, c) => sum + c.wht_amount, 0)

  // Unique years for filter
  const years = [...new Set(allCredits.map((c) => c.tax_year).filter(Boolean))].sort((a, b) => (b ?? 0) - (a ?? 0))

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WHT Credits</h1>
          <p className="text-sm text-gray-500 mt-0.5">Withholding tax deducted by clients on payments</p>
        </div>
        {totalAvailable > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
            <span className="text-amber-700">Total Available: </span>
            <span className="font-bold text-amber-900 text-base">{formatCurrency(totalAvailable)}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <select
          name="year"
          defaultValue={yearParam ?? ''}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
          style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
          onChange={(e) => {
            const url = new URL(window.location.href)
            if (e.target.value) url.searchParams.set('year', e.target.value)
            else url.searchParams.delete('year')
            window.location.href = url.toString()
          }}
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={statusParam ?? ''}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
          style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
          onChange={(e) => {
            const url = new URL(window.location.href)
            if (e.target.value && e.target.value !== 'all') url.searchParams.set('status', e.target.value)
            else url.searchParams.delete('status')
            window.location.href = url.toString()
          }}
        >
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="utilised">Utilised</option>
          <option value="expired">Expired</option>
        </select>
      </form>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No WHT credits found.</p>
          <p className="text-gray-300 text-xs mt-1">Credits appear here when payments with WHT deductions are logged.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Campaign</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Invoice</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">WHT Amount</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Rate</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Cert #</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Tax Year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((credit) => (
                  <tr key={credit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {credit.client?.client_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {credit.campaign ? (
                        <div>
                          <p className="font-mono text-xs text-teal-600">{credit.campaign.tracker_id}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{credit.campaign.title}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {credit.payment?.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(credit.wht_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                      {credit.wht_rate != null ? `${(credit.wht_rate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {credit.wht_type ? (WHT_TYPE_LABELS[credit.wht_type] ?? credit.wht_type) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden lg:table-cell">
                      {credit.certificate_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {formatDate(credit.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[credit.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {credit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                      {credit.tax_year ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">
                    {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(filtered.reduce((sum, c) => sum + c.wht_amount, 0))}
                  </td>
                  <td colSpan={6} className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
