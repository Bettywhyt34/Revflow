import { createAdminClient } from '@/lib/supabase'
import type { CampaignWithRelations } from '@/types'

export async function getCampaigns(orgId: string): Promise<CampaignWithRelations[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, account_manager:account_manager_id(id, full_name), client:client_id(id, client_name, email, cc_emails, address, client_code)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getCampaigns error:', error)
    return []
  }

  return (data ?? []) as unknown as CampaignWithRelations[]
}

export async function getCampaignById(
  id: string,
  orgId: string,
): Promise<CampaignWithRelations | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, account_manager:account_manager_id(id, full_name), client:client_id(id, client_name, email, cc_emails, address, client_code)')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('getCampaignById error:', error)
    return null
  }

  return data as unknown as CampaignWithRelations | null
}

export async function getFinanceExecs(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('org_id', orgId)
    .eq('role', 'finance_exec')
    .order('full_name')

  return data ?? []
}

export async function getCampaignPaymentsTotal(campaignId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('campaign_id', campaignId)

  if (!data) return 0
  return data.reduce((sum, p) => sum + (p.amount ?? 0), 0)
}

export async function getCampaignNotifications(campaignId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, message, created_at, read_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(20)

  return data ?? []
}
