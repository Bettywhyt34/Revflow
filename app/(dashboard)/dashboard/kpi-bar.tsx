import type { DashboardKPIs } from '@/lib/data/dashboard'

function fmt(n: number, currency = '₦'): string {
  if (n >= 1_000_000_000) return `${currency}${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(0)}K`
  return `${currency}${n.toFixed(0)}`
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  valueClass?: string
}

function KpiCard({ label, value, sub, valueClass = '' }: KpiCardProps) {
  return (
    <div className="bg-card border rounded-lg p-3 sm:p-4 min-h-[80px] flex flex-col justify-between">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{label}</p>
      <div>
        <p className={`text-lg sm:text-xl font-bold leading-tight ${valueClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

interface KpiBarProps {
  kpis: DashboardKPIs
}

export default function KpiBar({ kpis }: KpiBarProps) {
  const rateColor =
    kpis.collectionRate >= 80
      ? 'text-green-600'
      : kpis.collectionRate >= 60
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        label="Total Planned"
        value={fmt(kpis.totalPlanned)}
        sub={`${kpis.campaignCount} campaigns`}
      />
      <KpiCard
        label="Final Billable"
        value={fmt(kpis.finalBillable)}
      />
      <KpiCard
        label="Total Collected"
        value={fmt(kpis.totalCollected)}
      />
      <KpiCard
        label="Balance Outstanding"
        value={fmt(kpis.balanceOutstanding)}
        valueClass={kpis.balanceOutstanding > 0 ? 'text-red-600' : ''}
      />
      <KpiCard
        label="Write-Off Total"
        value={fmt(kpis.writeOffTotal)}
        valueClass={kpis.writeOffTotal > 0 ? 'text-orange-600' : ''}
      />
      <KpiCard
        label="Collection Rate"
        value={`${kpis.collectionRate.toFixed(1)}%`}
        valueClass={rateColor}
      />
    </div>
  )
}
