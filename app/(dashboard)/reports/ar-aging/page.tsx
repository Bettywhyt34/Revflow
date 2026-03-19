import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardData } from '@/lib/data/dashboard'
import { getFilterOptions } from '@/lib/data/dashboard'
import type { UserRole } from '@/types'
import type { InvoiceAgingRow } from '@/lib/data/dashboard'

export const metadata = { title: 'AR Aging — Revflow' }

function formatCurrency(value: number, currency = 'NGN'): string {
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

const BUCKETS: InvoiceAgingRow['bucket'][] = ['0-30', '31-60', '61-90', '90+']

const BUCKET_COLORS: Record<string, string> = {
  '0-30': 'bg-green-100 text-green-700',
  '31-60': 'bg-yellow-100 text-yellow-700',
  '61-90': 'bg-orange-100 text-orange-700',
  '90+': 'bg-red-100 text-red-700',
}

export default async function ArAgingPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; exec?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = session.user.role as UserRole
  if (userRole !== 'admin' && userRole !== 'finance_exec') redirect('/dashboard')

  const orgId = session.user.orgId
  const { bucket: bucketParam, exec: execParam } = await searchParams

  const [{ agingRows }, filterOptions] = await Promise.all([
    getDashboardData(orgId, { dateRange: 'all_time' }),
    getFilterOptions(orgId),
  ])

  // Apply filters
  const filtered = agingRows.filter((row) => {
    if (bucketParam && bucketParam !== 'all' && row.bucket !== bucketParam) return false
    if (execParam && execParam !== 'all' && row.financeExec !== execParam) return false
    return true
  })

  // Group by bucket for summary
  const bucketSummary = BUCKETS.map((b) => {
    const rows = filtered.filter((r) => r.bucket === b)
    return {
      bucket: b,
      count: rows.length,
      total: rows.reduce((s, r) => s + r.balance, 0),
    }
  })

  const grandTotal = filtered.reduce((s, r) => s + r.balance, 0)

  const execNames = [...new Set(agingRows.map((r) => r.financeExec))]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/reports" className="hover:text-teal-600 transition-colors">Reports</Link>
            <span>/</span>
            <span className="text-gray-600">AR Aging</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AR Aging</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outstanding invoices grouped by age</p>
        </div>
        <a
          href="/api/reports/ar-aging/export"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          Export Excel
        </a>
      </div>

      {/* Bucket Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bucketSummary.map((b) => (
          <div key={b.bucket} className="bg-white rounded-xl border border-gray-200 p-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_COLORS[b.bucket]}`}>
              {b.bucket} days
            </span>
            <p className="mt-2 text-lg font-bold text-gray-900">{formatCurrency(b.total)}</p>
            <p className="text-xs text-gray-400">{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <select
          name="bucket"
          defaultValue={bucketParam ?? ''}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          onChange={(e) => {
            const url = new URL(window.location.href)
            if (e.target.value) url.searchParams.set('bucket', e.target.value)
            else url.searchParams.delete('bucket')
            window.location.href = url.toString()
          }}
        >
          <option value="">All Buckets</option>
          {BUCKETS.map((b) => (
            <option key={b} value={b}>{b} days</option>
          ))}
        </select>

        {filterOptions.financeExecs.length > 0 && (
          <select
            name="exec"
            defaultValue={execParam ?? ''}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            onChange={(e) => {
              const url = new URL(window.location.href)
              if (e.target.value) url.searchParams.set('exec', e.target.value)
              else url.searchParams.delete('exec')
              window.location.href = url.toString()
            }}
          >
            <option value="">All Execs</option>
            {execNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </form>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No outstanding invoices found.</p>
          <p className="text-gray-300 text-xs mt-1">Outstanding invoices appear here when their balance exceeds zero.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Campaign</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Invoice #</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Amount</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Balance</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Due Date</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Days Overdue</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Bucket</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden lg:table-cell">Exec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.documentId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.clientName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={row.nextActionHref}
                        className="text-teal-600 hover:underline text-xs font-medium truncate max-w-[140px] block"
                      >
                        {row.campaignTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{row.documentNumber}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(row.totalAmount, row.currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.balance, row.currency)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden md:table-cell">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.daysOverdue}d</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_COLORS[row.bucket]}`}>
                        {row.bucket}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">{row.financeExec}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">
                    {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(filtered.reduce((s, r) => s + r.totalAmount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={4} className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
