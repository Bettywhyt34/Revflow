export type UserRole = 'admin' | 'planner' | 'finance_exec' | 'compliance'

export interface Organisation {
  id: string
  name: string
  country: string
  default_currency: string
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole | null
  org_id: string
  last_login: string | null
  created_at: string
  email_notifications?: boolean
}

export interface OrgSettings {
  id: string
  org_id: string
  org_name: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  default_currency: string
  tax_id: string | null
  rc_number: string | null
  address: string | null
  invoice_prefix: string
  payment_terms: string
  agency_fee_pct: number
  default_proforma_template: string
  default_invoice_template: string
  created_at: string
  updated_at: string
}

export interface OrgBankAccount {
  id: string
  org_id: string
  bank_name: string
  account_name: string
  account_number: string
  bank_code: string | null
  currency: string
  label: string | null
  is_default: boolean
  created_at: string
}

export type CampaignStatus =
  | 'draft'
  | 'plan_submitted'
  | 'proforma_sent'
  | 'po_received'
  | 'invoice_sent'
  | 'partially_paid'
  | 'fully_paid'
  | 'compliance_uploaded'
  | 'closed'
  | 'cancelled'

export type CampaignType = 'direct' | 'agency' | 'programmatic'

export type DetectionConfidence = 'high' | 'medium' | 'low' | 'not_found'
export type ExtractionMethod = 'excel_direct' | 'pdf_text' | 'pdf_ocr' | 'manual'

export interface Campaign {
  id: string
  org_id: string
  tracker_id: string
  title: string
  advertiser: string
  brand: string
  agency_name: string | null
  agency_fee_pct: number
  campaign_type: CampaignType
  status: CampaignStatus
  planned_contract_value: number | null
  currency: string
  start_date: string | null
  end_date: string | null
  account_manager_id: string | null
  plan_reference: string | null
  notes: string | null
  po_number: string | null
  po_received_date: string | null
  po_amount: number | null
  client_id: string | null
  // Compliance fields
  compliance_amount_before_vat: number | null
  compliance_pct: number | null
  final_billable: number | null
  adjustment_write_off: number | null
  compliance_disputed: boolean
  compliance_dispute_reason: string | null
  compliance_confirmed_by: string | null
  compliance_confirmed_at: string | null
  over_delivery: boolean
  over_delivery_pct: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  org_id: string
  client_name: string
  customer_id: string | null
  contact_person: string | null
  email: string | null
  cc_emails: string[]
  phone: string | null
  address: string | null
  payment_terms: string
  default_currency: string
  notes: string | null
  preferred_bank_account_id: string | null
  wht_applicable: boolean
  wht_type: string
  wht_rate: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignWithRelations extends Campaign {
  account_manager: { id: string; full_name: string } | null
  client: {
    id: string
    client_name: string
    customer_id: string | null
    email: string | null
    cc_emails: string[]
    address: string | null
    payment_terms: string | null
    wht_applicable: boolean | null
    wht_type: string | null
    wht_rate: number | null
  } | null
}

export interface Payment {
  id: string
  campaign_id: string
  document_id: string | null
  amount: number
  currency: string
  payment_date: string
  payment_method: 'bank_transfer' | 'cheque' | 'cash' | 'other'
  reference: string | null
  notes: string | null
  wht_applicable: boolean
  wht_amount: number
  wht_rate: number | null
  wht_certificate_number: string | null
  wht_credit_note_number: string | null
  actual_cash_received: number | null
  total_settled: number | null
  logged_by: string
  created_at: string
}

export interface WhtCredit {
  id: string
  org_id: string
  campaign_id: string | null
  payment_id: string | null
  client_id: string | null
  wht_amount: number
  wht_rate: number | null
  wht_type: string | null
  certificate_number: string | null
  credit_note_number: string | null
  tax_year: number | null
  status: 'available' | 'utilised' | 'expired'
  created_at: string
}
