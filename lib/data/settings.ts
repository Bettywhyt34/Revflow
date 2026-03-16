import { createAdminClient } from '@/lib/supabase'
import type { OrgSettings, OrgBankAccount } from '@/types'

const DEFAULTS: Omit<OrgSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'> = {
  org_name: null,
  logo_url: null,
  primary_color: '#0D9488',
  secondary_color: '#065F59',
  default_currency: 'NGN',
  tax_id: null,
  rc_number: null,
  address: null,
  invoice_prefix: 'INV',
  payment_terms: 'Net 30',
  agency_fee_pct: 10,
  default_proforma_template: '1',
  default_invoice_template: '1',
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

export async function getOrgBankAccounts(orgId: string): Promise<OrgBankAccount[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('org_bank_accounts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
  return (data ?? []) as OrgBankAccount[]
}

export async function getDefaultBankAccount(orgId: string): Promise<OrgBankAccount | null> {
  const supabase = createAdminClient()
  // Try is_default=true first
  const { data: def } = await supabase
    .from('org_bank_accounts')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_default', true)
    .maybeSingle()
  if (def) return def as OrgBankAccount

  // Fallback to first row
  const { data: first } = await supabase
    .from('org_bank_accounts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return first ? (first as OrgBankAccount) : null
}
