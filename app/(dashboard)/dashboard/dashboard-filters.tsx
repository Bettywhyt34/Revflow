'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { DashboardFilters, DateRange, FilterOptions } from '@/lib/data/dashboard'

interface DashboardFiltersProps {
  filters: DashboardFilters
  filterOptions: FilterOptions
  userRole: string
}

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'This Month', value: 'this_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'All Time', value: 'all_time' },
  { label: 'Custom', value: 'custom' },
]

export default function DashboardFilters({
  filters,
  filterOptions,
  userRole,
}: DashboardFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function buildUrl(updates: Partial<DashboardFilters>): string {
    const next = { ...filters, ...updates }
    const params = new URLSearchParams()
    if (next.dateRange) params.set('range', next.dateRange)
    if (next.dateFrom) params.set('from', next.dateFrom)
    if (next.dateTo) params.set('to', next.dateTo)
    if (next.financeExecId) params.set('exec', next.financeExecId)
    if (next.clientId) params.set('client', next.clientId)
    return `/dashboard?${params.toString()}`
  }

  function setRange(value: DateRange) {
    router.push(buildUrl({ dateRange: value, dateFrom: undefined, dateTo: undefined }))
  }

  function setExec(id: string) {
    router.push(buildUrl({ financeExecId: id || undefined }))
  }

  function setClient(id: string) {
    router.push(buildUrl({ clientId: id || undefined }))
  }

  function setCustomDate(field: 'dateFrom' | 'dateTo', value: string) {
    router.push(buildUrl({ [field]: value || undefined }))
  }

  void searchParams // suppress unused warning

  return (
    <div className="space-y-3">
      {/* Quick range buttons */}
      <div className="flex flex-wrap gap-2">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium min-h-[36px] transition-colors ${
              filters.dateRange === r.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {filters.dateRange === 'custom' && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">From</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => setCustomDate('dateFrom', e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm min-h-[36px] bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">To</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => setCustomDate('dateTo', e.target.value)}
              className="border rounded-md px-2 py-1.5 text-sm min-h-[36px] bg-background"
            />
          </div>
        </div>
      )}

      {/* Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {userRole === 'admin' && (
          <select
            value={filters.financeExecId ?? ''}
            onChange={(e) => setExec(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm min-h-[36px] bg-background"
          >
            <option value="">All Finance Execs</option>
            {filterOptions.financeExecs.map((exec) => (
              <option key={exec.id} value={exec.id}>
                {exec.full_name}
              </option>
            ))}
          </select>
        )}

        <select
          value={filters.clientId ?? ''}
          onChange={(e) => setClient(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm min-h-[36px] bg-background"
        >
          <option value="">All Clients</option>
          {filterOptions.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
