import { createAdminClient } from '@/lib/supabase/server'
import { getCampaigns, getFinanceExecs } from '@/lib/data/campaigns'
import { fetchHolidays, countWorkingDays, countCalendarDays } from '@/lib/working-days'
import type { CampaignWithRelations, CampaignStatus } from '@/types'
import type { DocumentRow } from '@/lib/data/documents'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DateRange = 'this_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom'

export interface DashboardFilters {
  dateRange: DateRange
  dateFrom?: string
  dateTo?: string
  financeExecId?: string
  clientId?: string
}

export interface DashboardKPIs {
  totalPlanned: number
  finalBillable: number
  totalCollected: number
  balanceOutstanding: number
  writeOffTotal: number
  collectionRate: number
  campaignCount: number
}

export interface RevenueMonth {
  month: string // 'YYYY-MM'
  label: string // 'Jan 25'
  planned: number
  collected: number
  finalBillable: number
  writeOff: number
  rate: number
}

export interface ClientRevenueRow {
  clientId: string
  clientName: string
  finalBillable: number
  collected: number
  balance: number
  portfolioPct: number
}

export interface ComplianceCampaignRow {
  campaignId: string
  campaignTitle: string
  clientName: string
  financeExec: string
  planAmount: number
  complianceAmount: number
  compliancePct: number
  finalBillable: number
  writeOff: number
}

export interface WriteOffRow {
  clientName: string
  campaignId: string
  campaignTitle: string
  planned: number
  finalBillable: number
  writeOff: number
  writeOffPct: number
}

export interface InvoiceAgingRow {
  documentId: string
  documentNumber: string
  clientName: string
  campaignId: string
  campaignTitle: string
  totalAmount: number
  balance: number
  dueDate: string | null
  sentAt: string | null
  daysOverdue: number
  bucket: '0-30' | '31-60' | '61-90' | '90+'
  financeExec: string
  currency: string
  nextActionHref: string
}

export interface DSOClientRow {
  clientName: string
  campaignCount: number
  avgDso: number
  fastestDso: number
  slowestDso: number
}

export interface DSOExecRow {
  execName: string
  campaignCount: number
  avgDso: number
}

export interface QueueItem {
  campaignId: string
  campaignTitle: string
  advertiser: string
  clientName: string
  priority: 'OVERDUE' | 'ESCALATE' | 'CHASE' | 'ACTION' | 'COMPLIANCE' | 'AWAITING'
  issue: string
  days: number
  actionHref: string
  financeExecName: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  revenueByMonth: RevenueMonth[]
  clientRevenue: ClientRevenueRow[]
  complianceCampaigns: ComplianceCampaignRow[]
  writeOffs: WriteOffRow[]
  overDeliveryCount: number
  agingRows: InvoiceAgingRow[]
  dsoByClient: DSOClientRow[]
  dsoByExec: DSOExecRow[]
  overallDso: number
}

export interface FilterOptions {
  financeExecs: { id: string; full_name: string; email: string }[]
  clients: { id: string; client_name: string }[]
}

export interface AdminPanelData {
  overrideAlerts: { id: string; created_at: string; user: string; campaign: string; reason: string }[]
  failedUploads: { id: string; campaign_id: string; file_name: string; created_at: string }[]
  userActivity: { id: string; full_name: string; email: string; role: string; last_login: string | null; created_at: string }[]
  queueEscalations: QueueItem[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function resolveDateRange(
  range: DateRange,
  from?: string,
  to?: string,
): { from: Date | null; to: Date | null } {
  const now = new Date()
  if (range === 'all_time') return { from: null, to: null }
  if (range === 'custom') {
    return {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
    }
  }
  if (range === 'this_month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    }
  }
  if (range === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3)
    return {
      from: new Date(now.getFullYear(), q * 3, 1),
      to: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59),
    }
  }
  // this_year
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
  }
}

function filterCampaigns(
  campaigns: CampaignWithRelations[],
  dateRange: { from: Date | null; to: Date | null },
  execId?: string,
  clientId?: string,
): CampaignWithRelations[] {
  return campaigns.filter((c) => {
    if (execId && c.account_manager_id !== execId) return false
    if (clientId && c.client_id !== clientId) return false
    if (dateRange.from || dateRange.to) {
      // Filter by start_date or created_at
      const d = c.start_date ? new Date(c.start_date) : new Date(c.created_at)
      if (dateRange.from && d < dateRange.from) return false
      if (dateRange.to && d > dateRange.to) return false
    }
    return true
  })
}

function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function toYYYYMM(dateStr: string): string {
  return dateStr.substring(0, 7)
}

function agingBucket(daysOverdue: number): InvoiceAgingRow['bucket'] {
  if (daysOverdue <= 30) return '0-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

// ── Main Data Fetch ───────────────────────────────────────────────────────────

export async function getDashboardData(
  orgId: string,
  filters: DashboardFilters,
): Promise<DashboardData> {
  const supabase = createAdminClient()
  const dateRange = resolveDateRange(filters.dateRange, filters.dateFrom, filters.dateTo)

  // 1. Get campaigns
  const allCampaigns = await getCampaigns(orgId)
  const campaigns = filterCampaigns(allCampaigns, dateRange, filters.financeExecId, filters.clientId)
  const campaignIds = campaigns.map((c) => c.id)

  if (campaignIds.length === 0) {
    return emptyDashboardData()
  }

  // 2. Batch fetch payments + documents
  const [{ data: paymentsData }, { data: documentsData }] = await Promise.all([
    supabase
      .from('payments')
      .select('id, campaign_id, amount, actual_cash_received, total_settled, wht_amount, payment_date, currency')
      .in('campaign_id', campaignIds),
    supabase
      .from('documents')
      .select('id, campaign_id, type, status, document_number, total_amount, amount_before_vat, currency, due_date, sent_at, created_at, voided_at')
      .in('campaign_id', campaignIds)
      .is('voided_at', null),
  ])

  const payments = (paymentsData ?? []) as Array<{
    id: string
    campaign_id: string
    amount: number
    actual_cash_received: number | null
    total_settled: number | null
    wht_amount: number
    payment_date: string
    currency: string
  }>

  const documents = (documentsData ?? []) as Array<DocumentRow & { campaign_id: string }>

  // 3. Index by campaign
  const paymentsByCampaign = new Map<string, typeof payments>()
  for (const p of payments) {
    if (!paymentsByCampaign.has(p.campaign_id)) paymentsByCampaign.set(p.campaign_id, [])
    paymentsByCampaign.get(p.campaign_id)!.push(p)
  }

  const documentsByCampaign = new Map<string, typeof documents>()
  for (const d of documents) {
    if (!documentsByCampaign.has(d.campaign_id)) documentsByCampaign.set(d.campaign_id, [])
    documentsByCampaign.get(d.campaign_id)!.push(d)
  }

  // 4. Compute KPIs
  let totalPlanned = 0
  let finalBillable = 0
  let totalCollected = 0
  let writeOffTotal = 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build a per-campaign planned value from live document sums so we always
  // reflect ALL current proformas — not the potentially-stale stored field.
  const effectivePlannedMap = new Map<string, number>()
  for (const c of campaigns) {
    const cDocs = documentsByCampaign.get(c.id) ?? []
    const proformaSum = cDocs
      .filter((d) => d.type === 'proforma_invoice' && (d.status === 'current' || d.status === 'draft'))
      .reduce((s, d) => s + ((d as { amount_before_vat?: number | null }).amount_before_vat ?? 0), 0)
    const invoiceSum = cDocs
      .filter((d) => d.type === 'invoice' && d.status === 'current')
      .reduce((s, d) => s + ((d as { amount_before_vat?: number | null }).amount_before_vat ?? 0), 0)
    // Priority: proformas > invoices > stored planned_contract_value
    const effective = proformaSum > 0
      ? proformaSum
      : invoiceSum > 0
        ? invoiceSum
        : (c.planned_contract_value ?? 0)
    effectivePlannedMap.set(c.id, effective)
  }

  for (const c of campaigns) {
    const planned = effectivePlannedMap.get(c.id) ?? 0
    const fb = c.final_billable ?? planned
    const writeOff = c.adjustment_write_off ?? 0
    const cPayments = paymentsByCampaign.get(c.id) ?? []
    const collected = cPayments.reduce((s, p) => s + (p.actual_cash_received ?? p.amount ?? 0), 0)
    const whtTotal = cPayments.reduce((s, p) => s + (p.wht_amount ?? 0), 0)
    const totalSettled = collected + whtTotal

    totalPlanned += planned
    finalBillable += fb
    totalCollected += totalSettled
    writeOffTotal += writeOff
  }

  const balanceOutstanding = Math.max(0, finalBillable - totalCollected)
  const collectionRate = finalBillable > 0 ? (totalCollected / finalBillable) * 100 : 0

  // 5. Revenue by month
  const monthMap = new Map<string, RevenueMonth>()

  for (const c of campaigns) {
    const monthKey = c.start_date ? toYYYYMM(c.start_date) : toYYYYMM(c.created_at)
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        label: formatMonth(monthKey),
        planned: 0,
        collected: 0,
        finalBillable: 0,
        writeOff: 0,
        rate: 0,
      })
    }
    const row = monthMap.get(monthKey)!
    const ePlanned = effectivePlannedMap.get(c.id) ?? 0
    row.planned += ePlanned
    row.finalBillable += c.final_billable ?? ePlanned
    row.writeOff += c.adjustment_write_off ?? 0
  }

  for (const p of payments) {
    const monthKey = toYYYYMM(p.payment_date)
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        label: formatMonth(monthKey),
        planned: 0,
        collected: 0,
        finalBillable: 0,
        writeOff: 0,
        rate: 0,
      })
    }
    const row = monthMap.get(monthKey)!
    row.collected += (p.actual_cash_received ?? p.amount ?? 0) + (p.wht_amount ?? 0)
  }

  const revenueByMonth = Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({
      ...r,
      rate: r.finalBillable > 0 ? (r.collected / r.finalBillable) * 100 : 0,
    }))

  // 6. Client Revenue
  const clientMap = new Map<string, ClientRevenueRow>()
  for (const c of campaigns) {
    const clientId = c.client_id ?? 'unknown'
    const clientName = c.client?.client_name ?? 'Unknown Client'
    const cPayments = paymentsByCampaign.get(c.id) ?? []
    const collected = cPayments.reduce(
      (s, p) => s + (p.actual_cash_received ?? p.amount ?? 0) + (p.wht_amount ?? 0),
      0,
    )
    const fb = c.final_billable ?? (effectivePlannedMap.get(c.id) ?? 0)

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, { clientId, clientName, finalBillable: 0, collected: 0, balance: 0, portfolioPct: 0 })
    }
    const row = clientMap.get(clientId)!
    row.finalBillable += fb
    row.collected += collected
  }

  const clientRevenue = Array.from(clientMap.values())
    .map((r) => ({
      ...r,
      balance: Math.max(0, r.finalBillable - r.collected),
      portfolioPct: finalBillable > 0 ? (r.finalBillable / finalBillable) * 100 : 0,
    }))
    .sort((a, b) => b.finalBillable - a.finalBillable)

  // 7. Compliance campaigns
  const complianceCampaigns: ComplianceCampaignRow[] = campaigns
    .filter((c) => c.compliance_pct !== null || c.compliance_amount_before_vat !== null)
    .map((c) => ({
      campaignId: c.id,
      campaignTitle: c.title,
      clientName: c.client?.client_name ?? 'Unknown',
      financeExec: c.account_manager?.full_name ?? 'Unassigned',
      planAmount: effectivePlannedMap.get(c.id) ?? 0,
      complianceAmount: c.compliance_amount_before_vat ?? 0,
      compliancePct: c.compliance_pct ?? 0,
      finalBillable: c.final_billable ?? (effectivePlannedMap.get(c.id) ?? 0),
      writeOff: c.adjustment_write_off ?? 0,
    }))
    .sort((a, b) => b.planAmount - a.planAmount)

  // Overall compliance pct (weighted)
  const totalPlanForCompliance = campaigns.reduce((s, c) => s + (effectivePlannedMap.get(c.id) ?? 0), 0)
  const totalComplianceDelivered = campaigns.reduce((s, c) => s + (c.compliance_amount_before_vat ?? (effectivePlannedMap.get(c.id) ?? 0)), 0)
  const overallCompliancePct = totalPlanForCompliance > 0 ? (totalComplianceDelivered / totalPlanForCompliance) * 100 : 0

  // 8. Write-offs
  const writeOffs: WriteOffRow[] = campaigns
    .filter((c) => (c.adjustment_write_off ?? 0) > 0)
    .map((c) => {
      const planned = effectivePlannedMap.get(c.id) ?? 0
      const writeOff = c.adjustment_write_off ?? 0
      return {
        clientName: c.client?.client_name ?? 'Unknown',
        campaignId: c.id,
        campaignTitle: c.title,
        planned,
        finalBillable: c.final_billable ?? planned,
        writeOff,
        writeOffPct: planned > 0 ? (writeOff / planned) * 100 : 0,
      }
    })
    .sort((a, b) => b.writeOff - a.writeOff)

  const overDeliveryCount = campaigns.filter((c) => c.over_delivery).length

  // 9. Invoice Aging
  const agingRows: InvoiceAgingRow[] = []
  for (const c of campaigns) {
    const cDocs = documentsByCampaign.get(c.id) ?? []
    const invoices = cDocs.filter((d) => d.type === 'invoice' && d.status !== 'void')
    const cPayments = paymentsByCampaign.get(c.id) ?? []
    const totalPaid = cPayments.reduce(
      (s, p) => s + (p.actual_cash_received ?? p.amount ?? 0) + (p.wht_amount ?? 0),
      0,
    )

    for (const inv of invoices) {
      const invAmount = inv.total_amount ?? 0
      // Simplified: distribute balance proportionally across invoices
      const balance = Math.max(0, invAmount - totalPaid)
      if (balance <= 0) continue

      const dueDate = inv.due_date ? new Date(inv.due_date) : null
      const daysOverdue = dueDate ? countCalendarDays(dueDate, today) : 0

      agingRows.push({
        documentId: inv.id,
        documentNumber: inv.document_number,
        clientName: c.client?.client_name ?? 'Unknown',
        campaignId: c.id,
        campaignTitle: c.title,
        totalAmount: invAmount,
        balance,
        dueDate: inv.due_date,
        sentAt: inv.sent_at,
        daysOverdue,
        bucket: agingBucket(daysOverdue),
        financeExec: c.account_manager?.full_name ?? 'Unassigned',
        currency: inv.currency,
        nextActionHref: `/campaigns/${c.id}`,
      })
    }
  }
  agingRows.sort((a, b) => b.daysOverdue - a.daysOverdue)

  // 10. DSO
  const dsoClientMap = new Map<string, { clientName: string; dsos: number[] }>()
  const dsoExecMap = new Map<string, { execName: string; dsos: number[] }>()

  for (const c of campaigns) {
    const cPayments = paymentsByCampaign.get(c.id) ?? []
    if (cPayments.length === 0) continue
    const cDocs = documentsByCampaign.get(c.id) ?? []
    const invoices = cDocs.filter((d) => d.type === 'invoice' && d.sent_at)

    for (const inv of invoices) {
      if (!inv.sent_at) continue
      const lastPayment = cPayments.sort(
        (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
      )[0]
      const endDate = lastPayment ? new Date(lastPayment.payment_date) : today
      const dso = countCalendarDays(new Date(inv.sent_at), endDate)
      if (dso < 0) continue

      const clientKey = c.client_id ?? 'unknown'
      const clientName = c.client?.client_name ?? 'Unknown'
      if (!dsoClientMap.has(clientKey)) dsoClientMap.set(clientKey, { clientName, dsos: [] })
      dsoClientMap.get(clientKey)!.dsos.push(dso)

      const execKey = c.account_manager_id ?? 'unassigned'
      const execName = c.account_manager?.full_name ?? 'Unassigned'
      if (!dsoExecMap.has(execKey)) dsoExecMap.set(execKey, { execName, dsos: [] })
      dsoExecMap.get(execKey)!.dsos.push(dso)
    }
  }

  const dsoByClient: DSOClientRow[] = Array.from(dsoClientMap.entries())
    .map(([, v]) => ({
      clientName: v.clientName,
      campaignCount: v.dsos.length,
      avgDso: Math.round(v.dsos.reduce((s, d) => s + d, 0) / v.dsos.length),
      fastestDso: Math.min(...v.dsos),
      slowestDso: Math.max(...v.dsos),
    }))
    .sort((a, b) => b.avgDso - a.avgDso)

  const dsoByExec: DSOExecRow[] = Array.from(dsoExecMap.entries())
    .map(([, v]) => ({
      execName: v.execName,
      campaignCount: v.dsos.length,
      avgDso: Math.round(v.dsos.reduce((s, d) => s + d, 0) / v.dsos.length),
    }))
    .sort((a, b) => b.avgDso - a.avgDso)

  const allDsos = Array.from(dsoClientMap.values()).flatMap((v) => v.dsos)
  const overallDso = allDsos.length > 0
    ? Math.round(allDsos.reduce((s, d) => s + d, 0) / allDsos.length)
    : 0

  void overallCompliancePct // used elsewhere but kept to avoid TS unused warning

  return {
    kpis: {
      totalPlanned,
      finalBillable,
      totalCollected,
      balanceOutstanding,
      writeOffTotal,
      collectionRate,
      campaignCount: campaigns.length,
    },
    revenueByMonth,
    clientRevenue,
    complianceCampaigns,
    writeOffs,
    overDeliveryCount,
    agingRows,
    dsoByClient,
    dsoByExec,
    overallDso,
  }
}

function emptyDashboardData(): DashboardData {
  return {
    kpis: {
      totalPlanned: 0,
      finalBillable: 0,
      totalCollected: 0,
      balanceOutstanding: 0,
      writeOffTotal: 0,
      collectionRate: 0,
      campaignCount: 0,
    },
    revenueByMonth: [],
    clientRevenue: [],
    complianceCampaigns: [],
    writeOffs: [],
    overDeliveryCount: 0,
    agingRows: [],
    dsoByClient: [],
    dsoByExec: [],
    overallDso: 0,
  }
}

// ── My Queue ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: CampaignStatus[] = [
  'plan_submitted',
  'proforma_sent',
  'po_received',
  'invoice_sent',
  'partially_paid',
  'fully_paid',
  'compliance_uploaded',
]

export async function getMyQueueData(
  orgId: string,
  userId: string,
  role: string,
): Promise<QueueItem[]> {
  const supabase = createAdminClient()
  const allCampaigns = await getCampaigns(orgId)

  const campaigns = allCampaigns.filter((c) => {
    if (!ACTIVE_STATUSES.includes(c.status as CampaignStatus)) return false
    if (role === 'finance_exec' && c.account_manager_id !== userId) return false
    return true
  })

  if (campaigns.length === 0) return []

  const campaignIds = campaigns.map((c) => c.id)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all needed data in parallel
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [{ data: paymentsData }, { data: documentsData }, holidays] = await Promise.all([
    supabase
      .from('payments')
      .select('id, campaign_id, amount, actual_cash_received, wht_amount, payment_date')
      .in('campaign_id', campaignIds),
    supabase
      .from('documents')
      .select('id, campaign_id, type, status, total_amount, due_date, sent_at, created_at, voided_at')
      .in('campaign_id', campaignIds)
      .is('voided_at', null),
    fetchHolidays(ninetyDaysAgo, today),
  ])

  const payments = (paymentsData ?? []) as Array<{
    id: string
    campaign_id: string
    amount: number
    actual_cash_received: number | null
    wht_amount: number
    payment_date: string
  }>

  const documents = (documentsData ?? []) as Array<{
    id: string
    campaign_id: string
    type: string
    status: string
    total_amount: number | null
    due_date: string | null
    sent_at: string | null
    created_at: string
    voided_at: string | null
  }>

  const paymentsByCampaign = new Map<string, typeof payments>()
  for (const p of payments) {
    if (!paymentsByCampaign.has(p.campaign_id)) paymentsByCampaign.set(p.campaign_id, [])
    paymentsByCampaign.get(p.campaign_id)!.push(p)
  }

  const documentsByCampaign = new Map<string, typeof documents>()
  for (const d of documents) {
    if (!documentsByCampaign.has(d.campaign_id)) documentsByCampaign.set(d.campaign_id, [])
    documentsByCampaign.get(d.campaign_id)!.push(d)
  }

  const items: QueueItem[] = []

  for (const c of campaigns) {
    const cPayments = paymentsByCampaign.get(c.id) ?? []
    const cDocs = documentsByCampaign.get(c.id) ?? []

    const totalPaid = cPayments.reduce(
      (s, p) => s + (p.actual_cash_received ?? p.amount ?? 0) + (p.wht_amount ?? 0),
      0,
    )

    const proforma = cDocs
      .filter((d) => d.type === 'proforma_invoice' && d.status !== 'void')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const invoice = cDocs
      .filter((d) => d.type === 'invoice' && d.status !== 'void')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const hasCompliance = cDocs.some((d) => d.type === 'compliance')

    let item: QueueItem | null = null

    // Priority 1: OVERDUE
    if (
      ['invoice_sent', 'partially_paid'].includes(c.status) &&
      invoice &&
      invoice.due_date &&
      new Date(invoice.due_date) < today &&
      (invoice.total_amount ?? 0) - totalPaid > 0
    ) {
      const daysOverdue = countCalendarDays(new Date(invoice.due_date), today)
      item = {
        campaignId: c.id,
        campaignTitle: c.title,
        advertiser: c.advertiser,
        clientName: c.client?.client_name ?? 'Unknown',
        priority: 'OVERDUE',
        issue: `Invoice overdue by ${daysOverdue}d`,
        days: daysOverdue,
        actionHref: `/campaigns/${c.id}`,
        financeExecName: c.account_manager?.full_name ?? 'Unassigned',
      }
    }

    // Priority 2: ESCALATE — proforma sent ≥ 14 WD
    if (!item && c.status === 'proforma_sent' && proforma?.sent_at) {
      const wd = countWorkingDays(new Date(proforma.sent_at), today, holidays)
      if (wd >= 14) {
        item = {
          campaignId: c.id,
          campaignTitle: c.title,
          advertiser: c.advertiser,
          clientName: c.client?.client_name ?? 'Unknown',
          priority: 'ESCALATE',
          issue: `Proforma unanswered ${wd} WD`,
          days: wd,
          actionHref: `/campaigns/${c.id}`,
          financeExecName: c.account_manager?.full_name ?? 'Unassigned',
        }
      }
    }

    // Priority 3: CHASE — proforma sent 12–13 WD
    if (!item && c.status === 'proforma_sent' && proforma?.sent_at) {
      const wd = countWorkingDays(new Date(proforma.sent_at), today, holidays)
      if (wd >= 12) {
        item = {
          campaignId: c.id,
          campaignTitle: c.title,
          advertiser: c.advertiser,
          clientName: c.client?.client_name ?? 'Unknown',
          priority: 'CHASE',
          issue: `Follow up proforma (${wd} WD)`,
          days: wd,
          actionHref: `/campaigns/${c.id}`,
          financeExecName: c.account_manager?.full_name ?? 'Unassigned',
        }
      }
    }

    // Priority 4: CHASE — partially paid, not overdue
    if (!item && c.status === 'partially_paid' && invoice) {
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
      if (!dueDate || dueDate >= today) {
        const balance = Math.max(0, (invoice.total_amount ?? 0) - totalPaid)
        if (balance > 0) {
          item = {
            campaignId: c.id,
            campaignTitle: c.title,
            advertiser: c.advertiser,
            clientName: c.client?.client_name ?? 'Unknown',
            priority: 'CHASE',
            issue: `Partial payment — balance outstanding`,
            days: invoice.sent_at ? countCalendarDays(new Date(invoice.sent_at), today) : 0,
            actionHref: `/campaigns/${c.id}`,
            financeExecName: c.account_manager?.full_name ?? 'Unassigned',
          }
        }
      }
    }

    // Priority 5: ACTION — PO received ≥ 5 calendar days
    if (!item && c.status === 'po_received' && c.po_received_date) {
      const cd = countCalendarDays(new Date(c.po_received_date), today)
      if (cd >= 5) {
        item = {
          campaignId: c.id,
          campaignTitle: c.title,
          advertiser: c.advertiser,
          clientName: c.client?.client_name ?? 'Unknown',
          priority: 'ACTION',
          issue: `PO received ${cd}d ago — raise invoice`,
          days: cd,
          actionHref: `/campaigns/${c.id}/invoice/new`,
          financeExecName: c.account_manager?.full_name ?? 'Unassigned',
        }
      }
    }

    // Priority 6: ACTION — plan submitted ≥ 5 calendar days
    if (!item && c.status === 'plan_submitted') {
      const refDate = c.plan_date_received ?? c.created_at
      const cd = countCalendarDays(new Date(refDate), today)
      if (cd >= 5) {
        item = {
          campaignId: c.id,
          campaignTitle: c.title,
          advertiser: c.advertiser,
          clientName: c.client?.client_name ?? 'Unknown',
          priority: 'ACTION',
          issue: `Plan submitted ${cd}d ago — send proforma`,
          days: cd,
          actionHref: `/campaigns/${c.id}/proforma/new`,
          financeExecName: c.account_manager?.full_name ?? 'Unassigned',
        }
      }
    }

    // Priority 7: COMPLIANCE — invoice/payment stages without compliance doc
    if (
      !item &&
      ['invoice_sent', 'partially_paid', 'fully_paid'].includes(c.status) &&
      !hasCompliance
    ) {
      item = {
        campaignId: c.id,
        campaignTitle: c.title,
        advertiser: c.advertiser,
        clientName: c.client?.client_name ?? 'Unknown',
        priority: 'COMPLIANCE',
        issue: 'No compliance document uploaded',
        days: 0,
        actionHref: `/campaigns/${c.id}/compliance/new`,
        financeExecName: c.account_manager?.full_name ?? 'Unassigned',
      }
    }

    // Priority 8: AWAITING — invoice sent, balance > 0, not yet due
    if (!item && c.status === 'invoice_sent' && invoice) {
      const balance = Math.max(0, (invoice.total_amount ?? 0) - totalPaid)
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null
      if (balance > 0 && (!dueDate || dueDate >= today)) {
        const sentDays = invoice.sent_at ? countCalendarDays(new Date(invoice.sent_at), today) : 0
        item = {
          campaignId: c.id,
          campaignTitle: c.title,
          advertiser: c.advertiser,
          clientName: c.client?.client_name ?? 'Unknown',
          priority: 'AWAITING',
          issue: `Awaiting payment (sent ${sentDays}d ago)`,
          days: sentDays,
          actionHref: `/campaigns/${c.id}`,
          financeExecName: c.account_manager?.full_name ?? 'Unassigned',
        }
      }
    }

    if (item) items.push(item)
  }

  // Sort by priority severity
  const priorityOrder: Record<QueueItem['priority'], number> = {
    OVERDUE: 0,
    ESCALATE: 1,
    CHASE: 2,
    ACTION: 3,
    COMPLIANCE: 4,
    AWAITING: 5,
  }

  return items.sort((a, b) => {
    const po = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (po !== 0) return po
    return b.days - a.days
  })
}

// ── Filter Options ────────────────────────────────────────────────────────────

export async function getFilterOptions(orgId: string): Promise<FilterOptions> {
  const supabase = createAdminClient()

  const [execs, { data: clientsData }] = await Promise.all([
    getFinanceExecs(orgId),
    supabase
      .from('clients')
      .select('id, client_name')
      .eq('org_id', orgId)
      .order('client_name'),
  ])

  return {
    financeExecs: execs,
    clients: (clientsData ?? []) as { id: string; client_name: string }[],
  }
}

// ── Admin Panel Data ──────────────────────────────────────────────────────────

export async function getAdminPanelData(orgId: string): Promise<AdminPanelData> {
  const supabase = createAdminClient()

  const [{ data: notificationsData }, { data: failedUploadsData }, { data: usersData }] =
    await Promise.all([
      supabase
        .from('notifications')
        .select('id, created_at, message, campaign_id, user_id, type')
        .eq('org_id', orgId)
        .eq('type', 'override_alert')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('upload_records')
        .select('id, campaign_id, file_name, created_at, status')
        .eq('org_id', orgId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('users')
        .select('id, full_name, email, role, last_login, created_at')
        .eq('org_id', orgId)
        .order('last_login', { ascending: false }),
    ])

  const overrideAlerts = (notificationsData ?? []).map((n) => ({
    id: n.id as string,
    created_at: n.created_at as string,
    user: '',
    campaign: (n.campaign_id as string) ?? '',
    reason: (n.message as string) ?? '',
  }))

  const failedUploads = (failedUploadsData ?? []).map((u) => ({
    id: u.id as string,
    campaign_id: u.campaign_id as string,
    file_name: u.file_name as string,
    created_at: u.created_at as string,
  }))

  const userActivity = (usersData ?? []).map((u) => ({
    id: u.id as string,
    full_name: u.full_name as string,
    email: u.email as string,
    role: (u.role as string) ?? 'unknown',
    last_login: u.last_login as string | null,
    created_at: u.created_at as string,
  }))

  return {
    overrideAlerts,
    failedUploads,
    userActivity,
    queueEscalations: [], // populated from queue data in page
  }
}
