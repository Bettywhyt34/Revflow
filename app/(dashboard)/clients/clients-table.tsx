'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Building2, ChevronRight } from 'lucide-react'
import type { ClientWithStats } from '@/lib/data/clients'

function fmt(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`
  return `₦${amount.toFixed(0)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ClientsTable({ clients }: { clients: ClientWithStats[] }) {
  const [query, setQuery] = useState('')

  const filtered = clients.filter((c) =>
    c.client_name.toLowerCase().includes(query.toLowerCase()) ||
    (c.contact_person ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="w-full min-h-[44px] pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm
            text-gray-900 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition"
          style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Building2 className="h-8 w-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {query ? 'No clients match your search.' : 'No clients yet.'}
          </p>
          {!query && (
            <Link
              href="/clients/new"
              className="mt-3 inline-block text-sm font-medium hover:underline"
              style={{ color: '#0D9488' }}
            >
              Add your first client
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Client Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Contact Person
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Campaigns
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total Billed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Added
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <Link href={`/clients/${client.id}`} className="block">
                        <span className="font-semibold text-gray-900">{client.client_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {client.contact_person ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">
                      {client.email ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{client.phone ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center justify-center h-6 w-8 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                        {client.campaign_count}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                      {client.total_billed > 0 ? fmt(client.total_billed) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs">
                      {fmtDate(client.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/clients/${client.id}`}>
                        <ChevronRight className="h-4 w-4 text-gray-300 hover:text-gray-500 transition" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3.5 hover:bg-gray-50 transition"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{client.client_name}</p>
                  {client.email && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{client.email}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-400">
                      {client.campaign_count} campaign{client.campaign_count !== 1 ? 's' : ''}
                    </span>
                    {client.total_billed > 0 && (
                      <span className="text-xs font-medium text-gray-600">
                        {fmt(client.total_billed)} billed
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
