'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import type { UserRole } from '@/types'

export async function updateUserRoleAction(
  userId: string,
  role: UserRole | null,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }
  if (userId === session.user.id) return { error: 'You cannot change your own role.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .eq('org_id', session.user.orgId)

  if (error) return { error: 'Failed to update role.' }

  revalidatePath('/admin/users')
  return {}
}

export async function createInviteTokenAction(
  role: UserRole,
): Promise<{ token: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()

  // Generate a UUID token
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours

  const { error } = await supabase.from('invite_codes').insert({
    org_id: session.user.orgId,
    code: token,
    role,
    created_by: session.user.id,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('createInviteToken error:', error)
    return { error: 'Failed to create invite.' }
  }

  revalidatePath('/admin/users')
  return { token }
}

export async function revokeInviteAction(inviteId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  if (session.user.role !== 'admin') return { error: 'Admin access required.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('invite_codes')
    .delete()
    .eq('id', inviteId)
    .eq('org_id', session.user.orgId)
    .is('used_at', null) // only delete unused invites

  if (error) return { error: 'Failed to revoke invite.' }

  revalidatePath('/admin/users')
  return {}
}
