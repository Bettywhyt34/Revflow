import { createAdminClient } from '@/lib/supabase/server'
import type { Payment, WhtCredit } from '@/types'

export interface PaymentWithRelations extends Payment {
  document: { document_number: string; total_amount: number | null } | null
  logged_by_user: { full_name: string } | null
}

export interface WhtCreditWithRelations extends WhtCredit {
  client: { client_name: string } | null
  campaign: { tracker_id: string; title: string } | null
  payment: { reference: string | null } | null
}

export async function getPaymentsByCampaign(
  campaignId: string,
  orgId: string,
): Promise<PaymentWithRelations[]> {
  const supabase = createAdminClient()

  // Verify campaign belongs to org
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return []

  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, document:document_id(document_number, total_amount), logged_by_user:logged_by(full_name)',
    )
    .eq('campaign_id', campaignId)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getPaymentsByCampaign error:', error)
    return []
  }

  return (data ?? []) as unknown as PaymentWithRelations[]
}

export async function getCampaignCashTotal(campaignId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('actual_cash_received, amount')
    .eq('campaign_id', campaignId)

  if (!data) return 0
  return data.reduce((sum, p) => sum + (p.actual_cash_received ?? p.amount ?? 0), 0)
}

export async function getCampaignWhtTotal(campaignId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('wht_amount')
    .eq('campaign_id', campaignId)

  if (!data) return 0
  return data.reduce((sum, p) => sum + (p.wht_amount ?? 0), 0)
}

export async function getCampaignTotalSettled(campaignId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('total_settled, amount')
    .eq('campaign_id', campaignId)

  if (!data) return 0
  return data.reduce((sum, p) => sum + (p.total_settled ?? p.amount ?? 0), 0)
}

export async function getWhtCredits(orgId: string): Promise<WhtCreditWithRelations[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('wht_credits')
    .select(
      '*, client:client_id(client_name), campaign:campaign_id(tracker_id, title), payment:payment_id(reference)',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getWhtCredits error:', error)
    return []
  }

  return (data ?? []) as unknown as WhtCreditWithRelations[]
}
