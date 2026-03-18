'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  markNotificationRead,
  markAllNotificationsRead,
  type NotifPrefs,
} from '@/lib/data/notifications'

export async function markNotificationReadAction(notifId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  await markNotificationRead(notifId)
  return {}
}

export async function markAllNotificationsReadAction(): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }
  await markAllNotificationsRead(session.user.id, session.user.orgId)
  return {}
}

export async function saveNotificationPrefsAction(
  emailNotifications: boolean,
  notifPrefs?: Partial<NotifPrefs>,
): Promise<{ error?: string; ok?: true }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = { email_notifications: emailNotifications }
  if (notifPrefs) {
    updatePayload.notification_prefs = notifPrefs
  }

  const { error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', session.user.id)

  if (error) {
    console.error('saveNotificationPrefsAction:', error)
    return { error: 'Failed to save preferences.' }
  }

  revalidatePath('/settings')
  return { ok: true }
}
