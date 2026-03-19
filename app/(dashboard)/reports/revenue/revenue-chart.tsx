'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import type { RevenueMonth } from '@/lib/data/dashboard'

function shortCurrency(value: number): string {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`
  return `₦${value}`
}

export default function RevenueChart({ data }: { data: RevenueMonth[] }) {
  return (
    <div className="w-full min-w-0 h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11 }} width={70} />
          <Tooltip formatter={(v) => shortCurrency(Number(v))} />
          <Legend />
          <Bar dataKey="planned" name="Planned" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
          <Bar dataKey="collected" name="Collected" fill="#0d9488" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
