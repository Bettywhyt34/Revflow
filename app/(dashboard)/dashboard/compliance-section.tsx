'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ComplianceCampaignRow, WriteOffRow } from '@/lib/data/dashboard'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

interface ComplianceSectionProps {
  complianceCampaigns: ComplianceCampaignRow[]
  writeOffs: WriteOffRow[]
  overDeliveryCount: number
}

type SortField = 'compliancePct' | 'planAmount' | 'finalBillable' | 'writeOff'

export default function ComplianceSection({
  complianceCampaigns,
  writeOffs,
  overDeliveryCount,
}: ComplianceSectionProps) {
  const [sortField, setSortField] = useState<SortField>('planAmount')
  const [sortAsc, setSortAsc] = useState(false)

  // Overall compliance
  const totalPlan = complianceCampaigns.reduce((s, c) => s + c.planAmount, 0)
  const totalCompliance = complianceCampaigns.reduce((s, c) => s + c.complianceAmount, 0)
  const overallPct = totalPlan > 0 ? (totalCompliance / totalPlan) * 100 : 0
  const gap = Math.max(0, totalPlan - totalCompliance)

  const pieData = [
    { name: 'Delivered', value: Math.min(totalCompliance, totalPlan) },
    { name: 'Gap', value: gap },
  ]

  const sorted = [...complianceCampaigns].sort((a, b) => {
    const diff = a[sortField] - b[sortField]
    return sortAsc ? diff : -diff
  })

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((v) => !v)
    else { setSortField(field); setSortAsc(false) }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-muted-foreground/40 ml-1">↕</span>
    return <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-6">
      {/* Compliance Donut + Badge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-base">Portfolio Compliance</h3>
            {overDeliveryCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {overDeliveryCount} over-delivered
              </span>
            )}
          </div>

          {complianceCampaigns.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No compliance data</div>
          ) : (
            <div className="relative w-full min-w-0 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="75%"
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                  <Tooltip formatter={(v) => fmtM(v as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold">{overallPct.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">delivered</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-3">
          <h3 className="font-semibold text-base">Compliance Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Campaigns</span>
              <span className="font-medium">{complianceCampaigns.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Planned</span>
              <span className="font-medium">{fmtM(totalPlan)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compliance Delivered</span>
              <span className="font-medium text-blue-600">{fmtM(totalCompliance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compliance Gap</span>
              <span className={`font-medium ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {gap > 0 ? fmtM(gap) : '✓ No gap'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Over-Delivery Count</span>
              <span className="font-medium text-green-600">{overDeliveryCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance per Campaign */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <div className="p-4 sm:p-5 border-b">
          <h3 className="font-semibold text-base">Compliance per Campaign</h3>
        </div>
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No compliance data for selected period</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium">Campaign</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                <th
                  className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-foreground hidden md:table-cell"
                  onClick={() => toggleSort('planAmount')}
                >
                  Planned <SortIcon field="planAmount" />
                </th>
                <th
                  className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('compliancePct')}
                >
                  Compliance% <SortIcon field="compliancePct" />
                </th>
                <th
                  className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-foreground hidden sm:table-cell"
                  onClick={() => toggleSort('finalBillable')}
                >
                  Final Bill <SortIcon field="finalBillable" />
                </th>
                <th
                  className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-foreground hidden md:table-cell"
                  onClick={() => toggleSort('writeOff')}
                >
                  Write-Off <SortIcon field="writeOff" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.campaignId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <p className="font-medium truncate max-w-[180px]">{row.campaignTitle}</p>
                    <p className="text-xs text-muted-foreground">{row.financeExec}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">{row.clientName}</td>
                  <td className="px-4 py-2.5 text-right hidden md:table-cell">{fmtM(row.planAmount)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${row.compliancePct >= 100 ? 'text-green-600' : row.compliancePct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                    {row.compliancePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">{fmtM(row.finalBillable)}</td>
                  <td className={`px-4 py-2.5 text-right hidden md:table-cell ${row.writeOff > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {row.writeOff > 0 ? fmtM(row.writeOff) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Write-Off Summary */}
      {writeOffs.length > 0 && (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold text-base">Write-Off Summary</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium">Campaign</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Planned</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Final Bill</th>
                <th className="text-right px-4 py-2.5 font-medium">Write-Off</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">%</th>
              </tr>
            </thead>
            <tbody>
              {writeOffs.map((row) => (
                <tr key={row.campaignId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium truncate max-w-[160px]">{row.campaignTitle}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{row.clientName}</td>
                  <td className="px-4 py-2.5 text-right hidden md:table-cell">{fmtM(row.planned)}</td>
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell">{fmtM(row.finalBillable)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{fmtM(row.writeOff)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">{row.writeOffPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
