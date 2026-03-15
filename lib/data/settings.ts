import { createAdminClient } from '@/lib/supabase'
import type { OrgSettings } from '@/types'

const DEFAULTS: Omit<OrgSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'> = {
  org_name: null,
  logo_url: null,
  primary_color: '#0D9488',
  secondary_color: '#065F59',
  default_currency: 'NGN',
  vat_number: null,
  rc_number: null,
  address: null,
  invoice_prefix: 'INV',
  payment_terms: 'Net 30',
  agency_fee_pct: 10,
  bank_name: null,
  bank_account_name: null,
  bank_account_number: null,
  sort_code: null,
}

export async function getOrgSettings(orgId: string): Promise<OrgSettings | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('org_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  return data as OrgSettings | null
}

export async function getOrgSettingsWithDefaults(orgId: string): Promise<OrgSettings> {
  const row = await getOrgSettings(orgId)
  if (row) return row
  return {
    id: '',
    org_id: orgId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...DEFAULTS,
  }
}
