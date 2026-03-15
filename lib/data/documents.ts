import { createAdminClient } from '@/lib/supabase'

export interface DocumentRow {
  id: string
  type: string
  status: string
  document_number: string
  amount_before_vat: number | null
  agency_fee_amount: number | null
  vat_amount: number | null
  total_amount: number | null
  currency: string
  issue_date: string | null
  due_date: string | null
  sent_at: string | null
  created_at: string
}

export interface ProformaDocument extends DocumentRow {
  recognition_period_start: string | null
  recognition_period_end: string | null
  recipient_email: string | null
  recipient_name: string | null
  cc_emails: string[]
  bcc_emails: string[]
  subject: string | null
  sent_by: string | null
  notes: string | null
  terms: string | null
  created_by: string
  campaign: {
    id: string
    title: string
    advertiser: string
    agency_name: string | null
    campaign_type: string
    agency_fee_pct: number
    currency: string
    tracker_id: string
    planned_contract_value: number | null
    start_date: string | null
    end_date: string | null
    org_id: string
    client_id: string | null
  }
}

export async function getNextDocumentNumber(
  orgId: string,
  type: string,
): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('next_document_number', {
    p_org_id: orgId,
    p_type: type,
  })
  if (error) throw new Error(`Failed to generate document number: ${error.message}`)
  return data as string
}

export async function getDocumentsByCampaign(campaignId: string): Promise<DocumentRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('documents')
    .select(
      'id, type, status, document_number, amount_before_vat, agency_fee_amount, vat_amount, total_amount, currency, issue_date, due_date, sent_at, created_at',
    )
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  return (data ?? []) as DocumentRow[]
}

export async function getDocumentById(
  id: string,
  orgId: string,
): Promise<ProformaDocument | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('documents')
    .select(
      `*, campaign:campaign_id(
        id, title, advertiser, agency_name, campaign_type,
        agency_fee_pct, currency, tracker_id, planned_contract_value,
        start_date, end_date, org_id, client_id
      )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (!data) return null

  // Verify org ownership
  const campaign = (data as ProformaDocument).campaign
  if (!campaign || campaign.org_id !== orgId) return null

  return data as ProformaDocument
}
