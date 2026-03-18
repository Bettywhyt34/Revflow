'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import type { OrgBankAccount } from '@/types'

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function validColor(c: string, fallback: string): string {
  return COLOR_RE.test(c) ? c : fallback
}

// ── Org Profile ──────────────────────────────────────────────────────────────

export interface OrgProfileInput {
  org_name: string
  primary_color: string
  secondary_color: string
  default_currency: string
  tax_id: string
  rc_number: string
  address: string
}

export async function saveOrgProfileAction(
  input: OrgProfileInput,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('org_settings').upsert(
    {
      org_id: session.user.orgId,
      org_name: input.org_name || null,
      primary_color: validColor(input.primary_color, '#0D9488'),
      secondary_color: validColor(input.secondary_color, '#065F59'),
      default_currency: input.default_currency || 'NGN',
      tax_id: input.tax_id || null,
      rc_number: input.rc_number || null,
      address: input.address || null,
    },
    { onConflict: 'org_id' },
  )

  if (error) {
    console.error('saveOrgProfileAction:', error)
    return { error: 'Failed to save settings.' }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ── Document Settings ────────────────────────────────────────────────────────

export interface DocSettingsInput {
  invoice_prefix: string
  payment_terms: string
  agency_fee_pct: number
}

export async function saveDocSettingsAction(
  input: DocSettingsInput,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const prefix = input.invoice_prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'INV'

  const fee = Math.min(100, Math.max(0, Number(input.agency_fee_pct) || 0))

  const supabase = createAdminClient()
  const { error } = await supabase.from('org_settings').upsert(
    {
      org_id: session.user.orgId,
      invoice_prefix: prefix,
      payment_terms: input.payment_terms || 'Net 30',
      agency_fee_pct: fee,
    },
    { onConflict: 'org_id' },
  )

  if (error) {
    console.error('saveDocSettingsAction:', error)
    return { error: 'Failed to save settings.' }
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ── Notification Preferences ─────────────────────────────────────────────────

export async function saveNotificationPrefsAction(
  emailNotifications: boolean,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({ email_notifications: emailNotifications })
    .eq('id', session.user.id)

  if (error) {
    console.error('saveNotificationPrefsAction:', error)
    return { error: 'Failed to save preferences.' }
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ── Template Settings ────────────────────────────────────────────────────────

export interface TemplateSettingsInput {
  default_proforma_template: string
  default_invoice_template: string
}

export async function saveTemplateSettingsAction(
  input: TemplateSettingsInput,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('org_settings').upsert(
    {
      org_id: session.user.orgId,
      default_proforma_template: ['1', '2', '3'].includes(input.default_proforma_template)
        ? input.default_proforma_template
        : '1',
      default_invoice_template: ['1', '2', '3'].includes(input.default_invoice_template)
        ? input.default_invoice_template
        : '1',
    },
    { onConflict: 'org_id' },
  )

  if (error) {
    console.error('saveTemplateSettingsAction:', error)
    return { error: 'Failed to save template settings.' }
  }

  revalidatePath('/settings')
  return { ok: true }
}

// ── Bank Account CRUD (admin only) ───────────────────────────────────────────

export interface BankAccountInput {
  bank_name: string
  account_name: string
  account_number: string
  bank_code?: string
  currency?: string
  label?: string
}

export async function createBankAccountAction(
  input: BankAccountInput,
): Promise<{ error?: string; ok?: true; account?: OrgBankAccount }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  if (!input.bank_name.trim()) return { error: 'Bank name is required.' }
  if (!input.account_name.trim()) return { error: 'Account name is required.' }
  if (!input.account_number.trim()) return { error: 'Account number is required.' }

  const supabase = createAdminClient()
  const orgId = session.user.orgId

  // Count existing accounts — if 0, auto-set as default
  const { count } = await supabase
    .from('org_bank_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const isDefault = (count ?? 0) === 0

  const { data, error } = await supabase
    .from('org_bank_accounts')
    .insert({
      org_id: orgId,
      bank_name: input.bank_name.trim(),
      account_name: input.account_name.trim(),
      account_number: input.account_number.trim(),
      bank_code: input.bank_code?.trim() || null,
      currency: input.currency || 'NGN',
      label: input.label?.trim() || null,
      is_default: isDefault,
    })
    .select()
    .single()

  if (error) {
    console.error('createBankAccountAction:', error)
    return { error: 'Failed to create bank account.' }
  }

  revalidatePath('/settings')
  return { ok: true, account: data as OrgBankAccount }
}

export async function updateBankAccountAction(
  id: string,
  input: BankAccountInput,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const orgId = session.user.orgId

  // Verify ownership
  const { data: existing } = await supabase
    .from('org_bank_accounts')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!existing) return { error: 'Bank account not found.' }

  const { error } = await supabase
    .from('org_bank_accounts')
    .update({
      bank_name: input.bank_name.trim(),
      account_name: input.account_name.trim(),
      account_number: input.account_number.trim(),
      bank_code: input.bank_code?.trim() || null,
      currency: input.currency || 'NGN',
      label: input.label?.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: 'Failed to update bank account.' }

  revalidatePath('/settings')
  return { ok: true }
}

export async function deleteBankAccountAction(id: string): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const orgId = session.user.orgId

  // Verify ownership and check if default
  const { data: existing } = await supabase
    .from('org_bank_accounts')
    .select('id, is_default')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!existing) return { error: 'Bank account not found.' }

  const { error } = await supabase.from('org_bank_accounts').delete().eq('id', id)
  if (error) return { error: 'Failed to delete bank account.' }

  // If deleted row was default, promote next row alphabetically
  if (existing.is_default) {
    const { data: next } = await supabase
      .from('org_bank_accounts')
      .select('id')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('org_bank_accounts')
        .update({ is_default: true })
        .eq('id', next.id)
    }
  }

  revalidatePath('/settings')
  return { ok: true }
}

export async function setDefaultBankAccountAction(
  id: string,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const orgId = session.user.orgId

  // Verify ownership
  const { data: existing } = await supabase
    .from('org_bank_accounts')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!existing) return { error: 'Bank account not found.' }

  // Clear all defaults for org, then set target
  await supabase
    .from('org_bank_accounts')
    .update({ is_default: false })
    .eq('org_id', orgId)

  const { error } = await supabase
    .from('org_bank_accounts')
    .update({ is_default: true })
    .eq('id', id)

  if (error) return { error: 'Failed to set default.' }

  revalidatePath('/settings')
  return { ok: true }
}
