'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export interface ClientInput {
  clientName: string
  contactPerson?: string
  email?: string
  ccEmails?: string[]
  phone?: string
  address?: string
  paymentTerms?: string
  defaultCurrency?: string
  notes?: string
  preferredBankAccountId?: string | null
}

export async function createClientAction(
  input: ClientInput,
): Promise<{ error?: string; clientId?: string; clientName?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  if (!input.clientName.trim()) return { error: 'Client name is required.' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      org_id: orgId,
      client_name: input.clientName.trim(),
      contact_person: input.contactPerson?.trim() || null,
      email: input.email?.trim() || null,
      cc_emails: input.ccEmails ?? [],
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      payment_terms: input.paymentTerms ?? 'Net 30',
      default_currency: input.defaultCurrency ?? 'NGN',
      notes: input.notes?.trim() || null,
      preferred_bank_account_id: input.preferredBankAccountId ?? null,
      created_by: session.user.id,
    })
    .select('id, client_name')
    .single()

  if (error) {
    console.error('createClient error:', error)
    return { error: 'Failed to create client.' }
  }

  revalidatePath('/clients')
  return { clientId: data.id, clientName: data.client_name }
}

export async function updateClientAction(
  id: string,
  input: ClientInput,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('clients')
    .update({
      client_name: input.clientName.trim(),
      contact_person: input.contactPerson?.trim() || null,
      email: input.email?.trim() || null,
      cc_emails: input.ccEmails ?? [],
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      payment_terms: input.paymentTerms ?? 'Net 30',
      default_currency: input.defaultCurrency ?? 'NGN',
      notes: input.notes?.trim() || null,
      preferred_bank_account_id: input.preferredBankAccountId ?? null,
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: 'Failed to update client.' }

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
  return {}
}
