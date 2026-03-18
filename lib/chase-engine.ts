/**
 * Chase Engine — Step 12
 *
 * Runs daily at 07:00 UTC Mon–Fri via Vercel Cron.
 * For each organisation, checks all active campaigns and fires
 * chase / escalation notifications as specified below.
 *
 * Four check types (all per campaign):
 *
 *  1. PROFORMA OUTSTANDING (no PO) — working day count from proforma sent_at
 *      - >= escalation_days (default 14): Finance Exec + Admin (ESCALATE)
 *      - >= reminder_days   (default 12): Finance Exec (CHASE)
 *
 *  2. INVOICE OVERDUE — calendar days from invoice due_date
 *      - >= escalation_days (default 14): Finance Exec + Admin
 *      - >= reminder2_days  (default  7): Finance Exec (second reminder)
 *      - >= reminder1_days  (default  1): Finance Exec (first reminder)
 *
 *  3. PO RECEIVED — NO INVOICE — calendar days from po_received_date
 *      - >= po_invoice_reminder_days (default 5): Finance Exec
 *
 *  4. PLAN UPLOADED — NO ACTION — calendar days from upload_records.created_at
 *      - >= plan_no_action_reminder_days (default 5): Finance Exec
 *
 * Deduplication: same-day dedup per (campaign, chase subtype).
 * The title prefix is stable per subtype; a LIKE query prevents re-sending
 * the same tier of notification to the same campaign on the same calendar day.
 */

import { createAdminClient } from '@/lib/supabase'
import { notifyRole } from '@/lib/notify'
import { fetchHolidays, countWorkingDays, countCalendarDays } from '@/lib/working-days'

// ── Config ────────────────────────────────────────────────────────────────────

interface ChaseConfig {
  proforma_po_reminder_days: number
  proforma_po_escalation_days: number
  po_invoice_reminder_days: number
  plan_no_action_reminder_days: number
  invoice_overdue_reminder1_days: number
  invoice_overdue_reminder2_days: number
  invoice_overdue_escalation_days: number
}

const DEFAULT_CONFIG: ChaseConfig = {
  proforma_po_reminder_days: 12,
  proforma_po_escalation_days: 14,
  po_invoice_reminder_days: 5,
  plan_no_action_reminder_days: 5,
  invoice_overdue_reminder1_days: 1,
  invoice_overdue_reminder2_days: 7,
  invoice_overdue_escalation_days: 14,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createAdminClient>

/**
 * Returns true if a chase notification with a title matching the given prefix
 * has already been sent today for this campaign (same-day dedup).
 *
 * We use a stable prefix (without the variable day count) so that
 * "PO chase: TRK-001 — sent 12 WD ago" and "... 13 WD ago" both
 * match `PO chase: TRK-001%` and count as the same tier.
 */
async function alreadySentToday(
  supabase: SupabaseClient,
  campaignId: string,
  titlePrefix: string,
): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('type', 'chase')
    .like('title', `${titlePrefix}%`)
    .gte('created_at', startOfDay.toISOString())

  return (count ?? 0) > 0
}

async function getChaseConfig(orgId: string): Promise<ChaseConfig> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('timeline_settings')
    .select('setting_value')
    .eq('org_id', orgId)
    .eq('setting_key', 'chase')
    .maybeSingle()

  if (!data?.setting_value) return DEFAULT_CONFIG

  const v = data.setting_value as Partial<ChaseConfig>
  return { ...DEFAULT_CONFIG, ...v }
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Per-campaign checks ───────────────────────────────────────────────────────

async function checkCampaign(
  supabase: SupabaseClient,
  orgId: string,
  campaign: {
    id: string
    title: string
    advertiser: string
    tracker_id: string
    status: string
    planned_contract_value: number | null
    currency: string | null
    po_received_date: string | null
  },
  config: ChaseConfig,
  today: Date,
  holidays: Set<string>,
): Promise<number> {
  let sent = 0
  const currency = campaign.currency ?? 'NGN'

  // ── 1. PROFORMA OUTSTANDING — no PO received ──────────────────────────────
  if (campaign.status === 'proforma_sent') {
    const { data: proforma } = await supabase
      .from('documents')
      .select('sent_at')
      .eq('campaign_id', campaign.id)
      .eq('type', 'proforma_invoice')
      .in('status', ['current', 'outdated'])
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const sentAt = proforma?.sent_at
      ? new Date(proforma.sent_at as string)
      : null

    if (sentAt) {
      const wd = countWorkingDays(sentAt, today, holidays)
      const prefix = `Escalation: ${campaign.tracker_id} — PO outstanding`

      if (wd >= config.proforma_po_escalation_days) {
        if (!await alreadySentToday(supabase, campaign.id, prefix)) {
          const title = `${prefix} (${wd} working days)`
          const msg = `${campaign.title} · ${campaign.advertiser}. Proforma was sent ${wd} working days ago — no PO received. Immediate action required.`
          await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
          await notifyRole(orgId, 'admin',        { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
          sent += 2
        }
      } else if (wd >= config.proforma_po_reminder_days) {
        const reminderPrefix = `PO chase: ${campaign.tracker_id} — proforma outstanding`
        if (!await alreadySentToday(supabase, campaign.id, reminderPrefix)) {
          const title = `${reminderPrefix} (${wd} working days)`
          const msg = `${campaign.title} · ${campaign.advertiser}. Proforma was sent ${wd} working days ago — no PO received.`
          await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
          sent += 1
        }
      }
    }
  }

  // ── 2. INVOICE OVERDUE ────────────────────────────────────────────────────
  if (['invoice_sent', 'partially_paid'].includes(campaign.status)) {
    const todayStr = today.toISOString().split('T')[0]

    const { data: overdueInvoices } = await supabase
      .from('documents')
      .select('id, document_number, due_date, total_amount')
      .eq('campaign_id', campaign.id)
      .eq('type', 'invoice')
      .eq('status', 'current')
      .lt('due_date', todayStr)

    if (overdueInvoices && overdueInvoices.length > 0) {
      // Fetch total settled
      const { data: payments } = await supabase
        .from('payments')
        .select('total_settled, amount')
        .eq('campaign_id', campaign.id)

      const totalSettled = (payments ?? []).reduce(
        (sum, p) => sum + ((p.total_settled as number | null) ?? (p.amount as number | null) ?? 0),
        0,
      )

      for (const inv of overdueInvoices) {
        const invTotal = (inv.total_amount as number | null) ?? 0
        const balance = Math.max(0, invTotal - totalSettled)
        if (balance < 0.01) continue // fully settled

        const dueDate = new Date(inv.due_date as string)
        const daysOverdue = countCalendarDays(dueDate, today)
        if (daysOverdue < config.invoice_overdue_reminder1_days) continue

        const docNum = inv.document_number as string

        if (daysOverdue >= config.invoice_overdue_escalation_days) {
          const prefix = `Escalation: ${docNum} — invoice overdue`
          if (!await alreadySentToday(supabase, campaign.id, prefix)) {
            const title = `${prefix} (${daysOverdue} days)`
            const msg = `${campaign.title} · ${campaign.advertiser}. Invoice ${docNum} is ${daysOverdue} days overdue. Balance: ${fmt(balance, currency)}.`
            await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
            await notifyRole(orgId, 'admin',        { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
            sent += 2
          }
        } else if (daysOverdue >= config.invoice_overdue_reminder2_days) {
          const prefix = `Second reminder: ${docNum} — invoice overdue`
          if (!await alreadySentToday(supabase, campaign.id, prefix)) {
            const title = `${prefix} (${daysOverdue} days)`
            const msg = `${campaign.title} · ${campaign.advertiser}. Invoice ${docNum} is ${daysOverdue} days overdue. Balance: ${fmt(balance, currency)}.`
            await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
            sent += 1
          }
        } else {
          // reminder1
          const prefix = `Invoice overdue: ${docNum}`
          if (!await alreadySentToday(supabase, campaign.id, prefix)) {
            const title = `${prefix} — due ${inv.due_date as string}`
            const msg = `${campaign.title} · ${campaign.advertiser}. Invoice ${docNum} was due on ${inv.due_date as string}. Balance: ${fmt(balance, currency)}.`
            await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
            sent += 1
          }
        }
      }
    }
  }

  // ── 3. PO RECEIVED — NO INVOICE CREATED ──────────────────────────────────
  if (campaign.status === 'po_received' && campaign.po_received_date) {
    const { count: invCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('type', 'invoice')
      .neq('status', 'void')

    if ((invCount ?? 0) === 0) {
      const poDate = new Date(campaign.po_received_date)
      const daysSincePo = countCalendarDays(poDate, today)

      if (daysSincePo >= config.po_invoice_reminder_days) {
        const prefix = `Action required: ${campaign.tracker_id} — create invoice`
        if (!await alreadySentToday(supabase, campaign.id, prefix)) {
          const title = `${prefix} (PO received ${daysSincePo} days ago)`
          const msg = `${campaign.title} · ${campaign.advertiser}. PO received ${daysSincePo} days ago — no invoice created yet.`
          await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
          sent += 1
        }
      }
    }
  }

  // ── 4. PLAN UPLOADED — NO ACTION ─────────────────────────────────────────
  if (campaign.status === 'plan_submitted') {
    const { data: latestUpload } = await supabase
      .from('upload_records')
      .select('created_at')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestUpload?.created_at) {
      // Check no proforma or invoice exists
      const { count: docCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('type', ['proforma_invoice', 'invoice'])
        .neq('status', 'void')

      if ((docCount ?? 0) === 0) {
        const uploadDate = new Date(latestUpload.created_at as string)
        const daysSince = countCalendarDays(uploadDate, today)

        if (daysSince >= config.plan_no_action_reminder_days) {
          const prefix = `Plan no action: ${campaign.tracker_id}`
          if (!await alreadySentToday(supabase, campaign.id, prefix)) {
            const title = `${prefix} — ${daysSince} days since upload`
            const msg = `${campaign.title} · ${campaign.advertiser}. Plan uploaded ${daysSince} days ago — no proforma or invoice has been created.`
            await notifyRole(orgId, 'finance_exec', { campaignId: campaign.id, type: 'chase', title, message: msg, actionPath: `/campaigns/${campaign.id}` })
            sent += 1
          }
        }
      }
    }
  }

  return sent
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runChaseEngine(orgId: string): Promise<{ sent: number }> {
  const supabase = createAdminClient()

  // Today at midnight UTC (canonical "today" for all checks)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const config = await getChaseConfig(orgId)

  // Fetch holidays covering the max threshold window (~20 calendar days ≈ 14 WD)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const holidays = await fetchHolidays(thirtyDaysAgo, today)

  // Fetch all active campaigns for this org
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, title, advertiser, tracker_id, status, planned_contract_value, currency, po_received_date')
    .eq('org_id', orgId)
    .not('status', 'in', '("closed","cancelled","draft")')

  if (error) {
    console.error('runChaseEngine: failed to fetch campaigns:', error)
    return { sent: 0 }
  }

  let sent = 0
  for (const campaign of campaigns ?? []) {
    try {
      sent += await checkCampaign(
        supabase,
        orgId,
        campaign as Parameters<typeof checkCampaign>[2],
        config,
        today,
        holidays,
      )
    } catch (err) {
      console.error(`runChaseEngine: error on campaign ${campaign.id}:`, err)
    }
  }

  return { sent }
}
