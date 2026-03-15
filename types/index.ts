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
  created_by: string
  created_at: string
  updated_at: string
}

export interface CampaignWithRelations extends Campaign {
  account_manager: { id: string; full_name: string } | null
}
