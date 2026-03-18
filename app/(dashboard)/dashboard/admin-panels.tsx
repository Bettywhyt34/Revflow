'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AdminPanelData, QueueItem } from '@/lib/data/dashboard'

interface AdminPanelsProps {
  adminData: AdminPanelData
  escalations: QueueItem[]
}

function Section({
  title,
  badge,
  children,
}: {
  title: string
  badge?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-muted/30 min-h-[56px]"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">{title}</h3>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  )
}

export default function AdminPanels({ adminData, escalations }: AdminPanelsProps) {
  const { overrideAlerts, failedUploads, userActivity, queueEscalations: _ } = adminData
  const allEscalations = escalations.filter((e) => e.priority === 'OVERDUE' || e.priority === 'ESCALATE')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Admin Panel</h2>

      {/* Override Alerts */}
      <Section title="Override Alerts" badge={overrideAlerts.length}>
        {overrideAlerts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No override alerts</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Campaign</th>
                  <th className="text-left px-4 py-2.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {overrideAlerts.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {a.campaign ? (
                        <Link href={`/campaigns/${a.campaign}`} className="text-primary hover:underline">
                          {a.campaign.substring(0, 8)}…
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* System Health */}
      <Section title="System Health" badge={failedUploads.length}>
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Failed Uploads</span>
            <span className={`text-sm font-semibold ${failedUploads.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {failedUploads.length}
            </span>
          </div>

          {failedUploads.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {failedUploads.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-red-50 rounded px-3 py-2 text-xs">
                  <span className="font-medium text-red-800 truncate max-w-[200px]">{u.file_name}</span>
                  <Link href={`/campaigns/${u.campaign_id}`} className="text-red-600 hover:underline ml-2 shrink-0">
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* User Activity */}
      <Section title="User Activity">
        {userActivity.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No user data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium">Last Login</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {userActivity.map((u) => {
                  const lastLoginDate = u.last_login ? new Date(u.last_login) : null
                  const daysSince = lastLoginDate
                    ? Math.floor((Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  const isActive = daysSince !== null && daysSince <= 7

                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize hidden sm:table-cell">
                        {u.role.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {lastLoginDate
                          ? lastLoginDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : 'Never'}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Overdue Escalations */}
      <Section title="Overdue Escalations" badge={allEscalations.length}>
        {allEscalations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No escalations</div>
        ) : (
          <div className="space-y-1.5 p-4">
            {allEscalations.map((item) => (
              <Link
                key={item.campaignId}
                href={item.actionHref}
                className={`flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors border-l-4 ${
                  item.priority === 'OVERDUE' ? 'border-l-red-500' : 'border-l-orange-500'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      item.priority === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.priority}
                    </span>
                    <span className="font-medium text-sm truncate">{item.campaignTitle}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.clientName} — {item.financeExecName}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{item.days}d</span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
