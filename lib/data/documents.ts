import { createAdminClient } from '@/lib/supabase/server'

export interface DocumentRow {
  id: string
  type: string
  status: string
  document_number: string
  version: number
  amount_before_vat: number | null
  agency_fee_amount: number | null
  vat_amount: number | null
  total_amount: number | null
  currency: string
  issue_date: string | null
  due_date: string | null
  sent_at: string | null
  created_at: string
  file_path: string | null
  // Bundle columns (migration 020)
  bundle_order: number | null
  parent_document_id: string | null
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  // Versioning columns (migration 021)
  cloned_from_id: string | null
  edit_reason: string | null
  superseded_at: string | null
  superseded_by: string | null
}

export interface UploadRecordRow {
  id: string
  campaign_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size_bytes: number
  confirmed_amount_before_vat: number
  created_at: string
}

export interface SavedLineItem {
  qty: number
  description: string
  unit_price: number
  line_total: number
}

export interface ProformaDocument extends DocumentRow {
  recognition_period_start: string | null
  recognition_period_end: string | null
  recipient_email: string | null
  recipient_name: string | null
  cc_emails: string[]
  bcc_emails: string[]
  subject: string | null
  invoice_subject: string | null
  line_items: SavedLineItem[]
  sent_by: string | null
  notes: string | null
  terms: string | null
  template_id: string
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

const DOCUMENT_ROW_SELECT = 'id, type, status, document_number, version, amount_before_vat, agency_fee_amount, vat_amount, total_amount, currency, issue_date, due_date, sent_at, created_at, file_path, bundle_order, parent_document_id, voided_by, voided_at, void_reason, reviewed_at, reviewed_by, cloned_from_id, edit_reason, superseded_at, superseded_by'

export async function getDocumentsByCampaign(campaignId: string): Promise<DocumentRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('documents')
    .select(DOCUMENT_ROW_SELECT)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  return (data ?? []) as DocumentRow[]
}

export async function getDocumentVersionHistory(documentNumber: string): Promise<DocumentRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('documents')
    .select(DOCUMENT_ROW_SELECT)
    .eq('document_number', documentNumber)
    .order('version', { ascending: true })
  return (data ?? []) as DocumentRow[]
}

export async function getLatestProformaForCampaign(
  campaignId: string,
): Promise<{ amount_before_vat: number; vat_amount: number; total_amount: number } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('documents')
    .select('amount_before_vat, vat_amount, total_amount')
    .eq('campaign_id', campaignId)
    .eq('type', 'proforma_invoice')
    .neq('status', 'void')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    amount_before_vat: data.amount_before_vat ?? 0,
    vat_amount: data.vat_amount ?? 0,
    total_amount: data.total_amount ?? 0,
  }
}

export async function getLatestUploadRecord(
  campaignId: string,
): Promise<UploadRecordRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('upload_records')
    .select('id, campaign_id, file_name, file_url, file_type, file_size_bytes, confirmed_amount_before_vat, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as UploadRecordRow | null
}

export async function getUploadRecordCount(campaignId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('upload_records')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  return count ?? 0
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
