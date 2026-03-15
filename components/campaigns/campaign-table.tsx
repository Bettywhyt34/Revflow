'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import StatusBadge from './status-badge'
import NextActionBadge from './next-action-badge'
import type { CampaignWithRelations, CampaignStatus, UserRole } from '@/types'

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'plan_submitted', label: 'Plan Submitted' },
  { value: 'proforma_sent', label: 'Proforma Sent' },
  { value: 'po_received', label: 'PO Received' },
  { value: 'invoice_sent', label: 'Invoice Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'compliance_uploaded', label: 'Compliance Uploaded' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function CampaignTable({
  campaigns,
  financeExecs,
  userRole,
}: {
  campaigns: CampaignWithRelations[]
  financeExecs: { id: string; full_name: string }[]
  userRole: UserRole | null
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [execFilter, setExecFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const canCreate = userRole === 'admin' || userRole === 'planner'

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return campaigns.filter((c) => {
      if (q && !c.advertiser.toLowerCase().includes(q) && !c.title.toLowerCase().includes(q)) {
        return false
      }
      if (statusFilter && c.status !== statusFilter) return false
      if (execFilter && c.account_manager_id !== execFilter) return false
      return true
    })
  }, [campaigns, search, statusFilter, execFilter])

  const hasActiveFilters = statusFilter || execFilter

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search client or campaign…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] pl-9 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition"
          />
        </div>

        <div className="flex gap-2">
          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 min-h-[44px] px-3.5 rounded-lg border text-sm font-medium transition ${
              showFilters || hasActiveFilters
                ? 'border-[#0D9488] text-[#0D9488] bg-teal-50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#0D9488]" />
            )}
          </button>

          {/* New Campaign */}
          {canCreate && (
            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-semibold text-white transition"
              style={{ background: '#0D9488' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
            >
              <Plus className="h-4 w-4" />
              <span>New Campaign</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-[#0D9488] transition"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {financeExecs.length > 0 && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Finance Exec</label>
              <select
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-[#0D9488] transition"
              >
                <option value="">All execs</option>
                {financeExecs.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={() => { setStatusFilter(''); setExecFilter('') }}
                className="min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-gray-400">
        {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
        {search || hasActiveFilters ? ' (filtered)' : ''}
      </p>

      {/* Table — desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Tracker ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Finance Exec</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Plan Value</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Next Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  {search || hasActiveFilters ? 'No campaigns match your filters.' : 'No campaigns yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50/60 transition-colors group"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-mono text-xs font-semibold text-[#0D9488] hover:underline"
                    >
                      {c.tracker_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-900 max-w-[140px] truncate">
                    {c.advertiser}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 max-w-[180px] truncate">
                    <Link href={`/campaigns/${c.id}`} className="hover:text-gray-900 hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                    {c.account_manager?.full_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={c.status as CampaignStatus} />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-gray-700 whitespace-nowrap">
                    {formatCurrency(c.planned_contract_value, c.currency)}
                  </td>
                  <td className="px-4 py-3.5">
                    <NextActionBadge status={c.status as CampaignStatus} />
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap text-xs">
                    {formatDate(c.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Card list — mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            {search || hasActiveFilters ? 'No campaigns match your filters.' : 'No campaigns yet.'}
          </p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-[#0D9488]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-mono text-xs font-semibold text-[#0D9488]">{c.tracker_id}</span>
                <StatusBadge status={c.status as CampaignStatus} />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{c.advertiser}</p>
              <p className="text-xs text-gray-500 truncate mb-3">{c.title}</p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <NextActionBadge status={c.status as CampaignStatus} />
                <span className="font-mono text-xs text-gray-600">
                  {formatCurrency(c.planned_contract_value, c.currency)}
                </span>
              </div>
              {c.account_manager && (
                <p className="text-xs text-gray-400 mt-2">{c.account_manager.full_name}</p>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
