'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { InvoiceAgingRow, DSOClientRow, DSOExecRow } from '@/lib/data/dashboard'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

const BUCKETS = ['All', '0-30', '31-60', '61-90', '90+'] as const
type BucketFilter = typeof BUCKETS[number]

interface ReceivablesSectionProps {
  agingRows: InvoiceAgingRow[]
  dsoByClient: DSOClientRow[]
  dsoByExec: DSOExecRow[]
  overallDso: number
}

type AgingSortField = 'daysOverdue' | 'balance' | 'totalAmount'

export default function ReceivablesSection({
  agingRows,
  dsoByClient,
  dsoByExec,
  overallDso,
}: ReceivablesSectionProps) {
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('All')
  const [agingSort, setAgingSort] = useState<AgingSortField>('daysOverdue')
  const [agingSortAsc, setAgingSortAsc] = useState(false)

  const filteredRows = agingRows.filter(
    (r) => bucketFilter === 'All' || r.bucket === bucketFilter,
  )

  const sortedRows = [...filteredRows].sort((a, b) => {
    const diff = a[agingSort] - b[agingSort]
    return agingSortAsc ? diff : -diff
  })

  function toggleSort(field: AgingSortField) {
    if (agingSort === field) setAgingSortAsc((v) => !v)
    else { setAgingSort(field); setAgingSortAsc(false) }
  }

  function SortIcon({ field }: { field: AgingSortField }) {
    if (agingSort !== field) return <span className="text-muted-foreground/40 ml-1">↕</span>
    return <span className="ml-1">{agingSortAsc ? '↑' : '↓'}</span>
  }

  // Aging summary bar chart data
  const bucketTotals = (['0-30', '31-60', '61-90', '90+'] as const).map((b) => ({
    bucket: b,
    balance: agingRows.filter((r) => r.bucket === b).reduce((s, r) => s + r.balance, 0),
  }))

  const top5Fastest = [...dsoByClient].sort((a, b) => a.avgDso - b.avgDso).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Overall DSO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 sm:p-5 text-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Overall DSO</p>
          <p className="text-4xl font-bold">{overallDso}</p>
          <p className="text-sm text-muted-foreground mt-1">days avg</p>
        </div>

        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Outstanding Invoices</p>
          <p className="text-2xl font-bold">{agingRows.length}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {fmtM(agingRows.reduce((s, r) => s + r.balance, 0))} total balance
          </p>
        </div>

        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Overdue ({'>'}30d)</p>
          <p className="text-2xl font-bold text-red-600">
            {agingRows.filter((r) => r.daysOverdue > 30).length}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {fmtM(agingRows.filter((r) => r.daysOverdue > 30).reduce((s, r) => s + r.balance, 0))} balance
          </p>
        </div>
      </div>

      {/* DSO by Client */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg overflow-x-auto">
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold text-base">DSO by Client</h3>
          </div>
          {dsoByClient.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No DSO data available</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Client</th>
                  <th className="text-right px-4 py-2.5 font-medium">Avg DSO</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Best</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Worst</th>
                </tr>
              </thead>
              <tbody>
                {dsoByClient.map((row) => (
                  <tr key={row.clientName} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.clientName}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${row.avgDso > 60 ? 'text-red-600' : row.avgDso > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                      {row.avgDso}d
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">{row.fastestDso}d</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">{row.slowestDso}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card border rounded-lg overflow-x-auto">
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold text-base">DSO by Finance Exec</h3>
          </div>
          {dsoByExec.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No exec DSO data</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Finance Exec</th>
                  <th className="text-right px-4 py-2.5 font-medium">Campaigns</th>
                  <th className="text-right px-4 py-2.5 font-medium">Avg DSO</th>
                </tr>
              </thead>
              <tbody>
                {dsoByExec.map((row) => (
                  <tr key={row.execName} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.execName}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{row.campaignCount}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${row.avgDso > 60 ? 'text-red-600' : row.avgDso > 30 ? 'text-amber-600' : 'text-green-600'}`}>
                      {row.avgDso}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fastest Paying Clients */}
      {top5Fastest.length > 0 && (
        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <h3 className="font-semibold text-base mb-4">Fastest Paying Clients</h3>
          <div className="space-y-2">
            {top5Fastest.map((client, i) => (
              <div key={client.clientName} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-green-500 text-white' :
                  i === 1 ? 'bg-green-400 text-white' :
                  i === 2 ? 'bg-green-300 text-green-900' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-sm">{client.clientName}</span>
                <span className="text-sm font-semibold text-green-600">{client.avgDso}d avg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aging Summary Chart */}
      {agingRows.length > 0 && (
        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <h3 className="font-semibold text-base mb-4">Aging Summary</h3>
          <div className="w-full min-w-0 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketTotals} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => fmtM(v as number)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => fmtM(v as number)} />
                <Bar
                  dataKey="balance"
                  name="Balance"
                  fill="#ef4444"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Invoice Aging Table */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 sm:p-5 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-base">Invoice Aging</h3>
          <div className="flex flex-wrap gap-1.5">
            {BUCKETS.map((b) => (
              <button
                key={b}
                onClick={() => setBucketFilter(b)}
                className={`px-2.5 py-1 text-xs rounded-md min-h-[28px] ${
                  bucketFilter === b
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {b}
                {b !== 'All' && (
                  <span className="ml-1 opacity-70">
                    ({agingRows.filter((r) => r.bucket === b).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {agingRows.length === 0 ? 'No outstanding invoices' : 'No invoices in this bucket'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                  <th
                    className="text-right px-4 py-2.5 font-medium cursor-pointer hidden md:table-cell"
                    onClick={() => toggleSort('totalAmount')}
                  >
                    Amount <SortIcon field="totalAmount" />
                  </th>
                  <th
                    className="text-right px-4 py-2.5 font-medium cursor-pointer"
                    onClick={() => toggleSort('balance')}
                  >
                    Balance <SortIcon field="balance" />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Due</th>
                  <th
                    className="text-right px-4 py-2.5 font-medium cursor-pointer"
                    onClick={() => toggleSort('daysOverdue')}
                  >
                    Days <SortIcon field="daysOverdue" />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.documentId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{row.documentNumber}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{row.campaignTitle}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell truncate max-w-[100px]">{row.clientName}</td>
                    <td className="px-4 py-2.5 text-right hidden md:table-cell">{fmtM(row.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600">{fmtM(row.balance)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${row.daysOverdue > 60 ? 'text-red-600' : row.daysOverdue > 30 ? 'text-amber-600' : row.daysOverdue > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {row.daysOverdue > 0 ? `+${row.daysOverdue}d` : row.daysOverdue === 0 ? 'Today' : `${Math.abs(row.daysOverdue)}d left`}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <Link href={row.nextActionHref} className="text-primary hover:underline text-xs">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
