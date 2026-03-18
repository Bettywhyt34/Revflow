'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { RevenueMonth, ClientRevenueRow } from '@/lib/data/dashboard'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
}

interface RevenueSectionProps {
  revenueByMonth: RevenueMonth[]
  clientRevenue: ClientRevenueRow[]
}

export default function RevenueSection({ revenueByMonth, clientRevenue }: RevenueSectionProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [showAllClients, setShowAllClients] = useState(false)
  const [sortField, setSortField] = useState<'finalBillable' | 'collected' | 'balance' | 'portfolioPct'>('finalBillable')

  const visibleClients = showAllClients ? clientRevenue : clientRevenue.slice(0, 10)
  const sortedClients = [...clientRevenue].sort((a, b) => b[sortField] - a[sortField])
  const top5 = clientRevenue.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Revenue Chart */}
      <div className="bg-card border rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-base">Revenue: Collected vs Planned</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 text-xs rounded-md min-h-[32px] ${chartType === 'bar' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 text-xs rounded-md min-h-[32px] ${chartType === 'line' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Line
            </button>
          </div>
        </div>

        {revenueByMonth.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No revenue data in selected period</div>
        ) : (
          <div className="w-full min-w-0 h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtM(v as number)} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => fmtFull(v as number)} />
                  <Legend />
                  <Bar dataKey="planned" name="Planned" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={revenueByMonth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtM(v as number)} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => fmtFull(v as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="planned" name="Planned" stroke="#94a3b8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="collected" name="Collected" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Revenue by Month table */}
      {revenueByMonth.length > 0 && (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold text-base">Revenue Per Month</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium">Month</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Planned</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Final Billable</th>
                <th className="text-right px-4 py-2.5 font-medium">Collected</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Write-Off</th>
                <th className="text-right px-4 py-2.5 font-medium">Rate%</th>
              </tr>
            </thead>
            <tbody>
              {revenueByMonth.map((row) => (
                <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">{fmtM(row.planned)}</td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">{fmtM(row.finalBillable)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtM(row.collected)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-600 hidden md:table-cell">{row.writeOff > 0 ? fmtM(row.writeOff) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${row.rate >= 80 ? 'text-green-600' : row.rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {row.rate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top 5 Clients */}
      {top5.length > 0 && (
        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <h3 className="font-semibold text-base mb-4">Top 5 Clients by Revenue</h3>
          <div className="space-y-2">
            {top5.map((client, i) => (
              <div key={client.clientId} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-400 text-yellow-900' :
                  i === 1 ? 'bg-gray-300 text-gray-700' :
                  i === 2 ? 'bg-amber-600 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{client.clientName}</span>
                    <span className="text-sm font-semibold shrink-0">{fmtM(client.finalBillable)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 bg-muted rounded-full flex-1">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, client.portfolioPct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{client.portfolioPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Revenue Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <div className="p-4 sm:p-5 border-b flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-base">Client Revenue Contribution</h3>
          <div className="text-xs text-muted-foreground">
            Sort by:{' '}
            {(['finalBillable', 'collected', 'balance', 'portfolioPct'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSortField(f)}
                className={`ml-2 underline-offset-2 ${sortField === f ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'finalBillable' ? 'Billable' : f === 'portfolioPct' ? '% Portfolio' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {clientRevenue.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No client data available</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Client</th>
                  <th className="text-right px-4 py-2.5 font-medium">Final Billable</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Collected</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Balance</th>
                  <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">% Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {(showAllClients ? sortedClients : sortedClients.slice(0, 10)).map((row) => (
                  <tr key={row.clientId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{row.clientName}</td>
                    <td className="px-4 py-2.5 text-right">{fmtM(row.finalBillable)}</td>
                    <td className="px-4 py-2.5 text-right text-green-700 hidden sm:table-cell">{fmtM(row.collected)}</td>
                    <td className={`px-4 py-2.5 text-right hidden sm:table-cell ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {row.balance > 0 ? fmtM(row.balance) : '✓'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden md:table-cell">{row.portfolioPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clientRevenue.length > 10 && (
              <div className="p-3 border-t text-center">
                <button
                  onClick={() => setShowAllClients((v) => !v)}
                  className="text-sm text-primary hover:underline min-h-[36px]"
                >
                  {showAllClients ? 'Show fewer' : `Show all ${clientRevenue.length} clients`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
