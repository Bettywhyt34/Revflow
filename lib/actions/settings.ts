'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

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
  vat_number: string
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
      vat_number: input.vat_number || null,
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
  bank_name: string
  bank_account_name: string
  bank_account_number: string
  sort_code: string
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
      bank_name: input.bank_name || null,
      bank_account_name: input.bank_account_name || null,
      bank_account_number: input.bank_account_number || null,
      sort_code: input.sort_code || null,
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
