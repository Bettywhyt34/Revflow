import { createAdminClient } from '@/lib/supabase/server'
import type { Client } from '@/types'

export interface ClientWithStats extends Client {
  campaign_count: number
  total_billed: number
  total_collected: number
  balance: number
}

export async function getClients(orgId: string): Promise<ClientWithStats[]> {
  const supabase = createAdminClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('org_id', orgId)
    .order('client_name')

  if (!clients || clients.length === 0) return []

  // Get campaign stats per client in one query
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, client_id, planned_contract_value')
    .eq('org_id', orgId)
    .in('client_id', clients.map((c) => c.id))

  const campaignIds = (campaigns ?? []).map((c) => c.id)

  const { data: payments } = campaignIds.length
    ? await supabase.from('payments').select('campaign_id, amount').in('campaign_id', campaignIds)
    : { data: [] }

  return clients.map((client) => {
    const clientCampaigns = (campaigns ?? []).filter((c) => c.client_id === client.id)
    const clientCampaignIds = clientCampaigns.map((c) => c.id)
    const totalBilled = clientCampaigns.reduce(
      (sum, c) => sum + (c.planned_contract_value ?? 0),
      0,
    )
    const totalCollected = (payments ?? [])
      .filter((p) => clientCampaignIds.includes(p.campaign_id))
      .reduce((sum, p) => sum + (p.amount ?? 0), 0)

    return {
      ...(client as Client),
      campaign_count: clientCampaigns.length,
      total_billed: totalBilled,
      total_collected: totalCollected,
      balance: totalBilled - totalCollected,
    }
  })
}

export async function getClientById(id: string, orgId: string): Promise<Client | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()
  return (data as Client) ?? null
}

export async function getClientCampaigns(clientId: string, orgId: string) {
  const supabase = createAdminClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, tracker_id, title, status, planned_contract_value, currency, created_at')
    .eq('client_id', clientId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (!campaigns || campaigns.length === 0) {
    return { campaigns: [], totalBilled: 0, totalCollected: 0 }
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('campaign_id, amount')
    .in('campaign_id', campaigns.map((c) => c.id))

  const totalBilled = campaigns.reduce((sum, c) => sum + (c.planned_contract_value ?? 0), 0)
  const totalCollected = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

  return { campaigns, totalBilled, totalCollected }
}

// Minimal list for selectors (new campaign form, etc.)
export async function getClientOptions(
  orgId: string,
): Promise<{ id: string; client_name: string; email: string | null; cc_emails: string[] }[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('clients')
    .select('id, client_name, email, cc_emails')
    .eq('org_id', orgId)
    .order('client_name')
  return (data ?? []) as { id: string; client_name: string; email: string | null; cc_emails: string[] }[]
}
