import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import {
  getDashboardData,
  getMyQueueData,
  getFilterOptions,
  getAdminPanelData,
  type DashboardFilters,
  type DateRange,
} from '@/lib/data/dashboard'
import DashboardFiltersBar from './dashboard-filters'
import KpiBar from './kpi-bar'
import RevenueSection from './revenue-section'
import ComplianceSection from './compliance-section'
import ReceivablesSection from './receivables-section'
import MyQueue from './my-queue'
import AdminPanels from './admin-panels'

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string; exec?: string; client?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth()
  const orgId = session?.user?.orgId ?? ''
  const userId = session?.user?.id ?? ''
  const role = (session?.user?.role ?? 'finance_exec') as string

  const sp = await searchParams
  const filters: DashboardFilters = {
    dateRange: (sp.range as DateRange) ?? 'all_time',
    dateFrom: sp.from,
    dateTo: sp.to,
    financeExecId: sp.exec,
    clientId: sp.client,
  }

  const [dashData, queueItems, filterOptions, adminData] = await Promise.all([
    getDashboardData(orgId, filters),
    getMyQueueData(orgId, userId, role),
    getFilterOptions(orgId),
    role === 'admin' ? getAdminPanelData(orgId) : null,
  ])

  return (
    <div className="space-y-6 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          AR overview for {session?.user?.name}
        </p>
      </div>

      {/* Filters */}
      <Suspense>
        <DashboardFiltersBar filters={filters} filterOptions={filterOptions} userRole={role} />
      </Suspense>

      {/* KPI Bar */}
      <KpiBar kpis={dashData.kpis} />

      {/* My Queue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">My Queue</h2>
          {queueItems.length > 0 && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {queueItems.length}
            </span>
          )}
        </div>
        <MyQueue items={queueItems} />
      </section>

      {/* Revenue Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Revenue</h2>
        <RevenueSection
          revenueByMonth={dashData.revenueByMonth}
          clientRevenue={dashData.clientRevenue}
        />
      </section>

      {/* Compliance Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Compliance</h2>
        <ComplianceSection
          complianceCampaigns={dashData.complianceCampaigns}
          writeOffs={dashData.writeOffs}
          overDeliveryCount={dashData.overDeliveryCount}
        />
      </section>

      {/* Receivables Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Receivables &amp; Aging</h2>
        <ReceivablesSection
          agingRows={dashData.agingRows}
          dsoByClient={dashData.dsoByClient}
          dsoByExec={dashData.dsoByExec}
          overallDso={dashData.overallDso}
        />
      </section>

      {/* Admin Panels */}
      {role === 'admin' && adminData && (
        <section>
          <AdminPanels
            adminData={adminData}
            escalations={queueItems}
          />
        </section>
      )}
    </div>
  )
}
