import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData, resolveDateRange } from '@/lib/data/dashboard'
import type { UserRole } from '@/types'
import RevenueChart from './revenue-chart'

export const metadata = { title: 'Revenue Summary — Revflow' }

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = session.user.role as UserRole
  if (userRole !== 'admin' && userRole !== 'finance_exec') redirect('/dashboard')

  const orgId = session.user.orgId
  const { year: yearParam } = await searchParams

  const currentYear = new Date().getFullYear()
  const selectedYear = yearParam ? parseInt(yearParam) : currentYear

  const dateFrom = `${selectedYear}-01-01`
  const dateTo = `${selectedYear}-12-31`

  const { revenueByMonth, kpis } = await getDashboardData(orgId, {
    dateRange: 'custom',
    dateFrom,
    dateTo,
  })

  // Year options: current year - 3 to current year + 1
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  // Grand totals
  const totalPlanned = revenueByMonth.reduce((s, r) => s + r.planned, 0)
  const totalFinalBillable = revenueByMonth.reduce((s, r) => s + r.finalBillable, 0)
  const totalCollected = revenueByMonth.reduce((s, r) => s + r.collected, 0)
  const totalWriteOff = revenueByMonth.reduce((s, r) => s + r.writeOff, 0)
  const overallRate = totalFinalBillable > 0 ? (totalCollected / totalFinalBillable) * 100 : 0

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/reports" className="hover:text-teal-600 transition-colors">Reports</Link>
            <span>/</span>
            <span className="text-gray-600">Revenue Summary</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly planned vs collected — {selectedYear}</p>
        </div>
        <a
          href={`/api/reports/revenue/export?year=${selectedYear}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          Export Excel
        </a>
      </div>

      {/* Year filter */}
      <form className="flex flex-wrap gap-3">
        <select
          name="year"
          defaultValue={String(selectedYear)}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          onChange={(e) => {
            window.location.href = `/reports/revenue?year=${e.target.value}`
          }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </form>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Planned</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Final Billable</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(totalFinalBillable)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Collected</p>
          <p className="text-lg font-bold text-teal-600 mt-1">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Collection Rate</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{pct(overallRate)}</p>
        </div>
      </div>

      {/* Chart */}
      {revenueByMonth.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Planned vs Collected</h2>
          <RevenueChart data={revenueByMonth} />
        </div>
      )}

      {/* Table */}
      {revenueByMonth.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No data for {selectedYear}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Month</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Planned</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Final Billable</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Collected</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Write-Off</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueByMonth.map((row) => (
                  <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.planned)}</td>
                    <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">{formatCurrency(row.finalBillable)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-teal-600">{formatCurrency(row.collected)}</td>
                    <td className="px-4 py-3 text-right text-red-500 hidden md:table-cell">
                      {row.writeOff > 0 ? formatCurrency(row.writeOff) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${row.rate >= 80 ? 'text-teal-600' : row.rate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {pct(row.rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalPlanned)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 hidden sm:table-cell">{formatCurrency(totalFinalBillable)}</td>
                  <td className="px-4 py-3 text-right font-bold text-teal-600">{formatCurrency(totalCollected)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500 hidden md:table-cell">{formatCurrency(totalWriteOff)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{pct(overallRate)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
