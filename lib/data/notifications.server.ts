/**
 * Server-only notification data functions.
 * Import this in Server Components, Route Handlers, and Server Actions.
 * For Client Components, import from ./notifications.client instead.
 */

import { createAdminClient } from '@/lib/supabase/server'
export type { NotificationType, NotificationRow, NotifPrefs } from './notifications.client'
export { DEFAULT_NOTIF_PREFS } from './notifications.client'

// ── Fetch notifications for a user (own + org-wide broadcasts) ───────────────
export async function getNotifications(
  userId: string,
  orgId: string,
  limit = 50,
): Promise<import('./notifications.client').NotificationRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, org_id, user_id, campaign_id, type, title, message, action_url, read_at, created_at')
    .eq('org_id', orgId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as import('./notifications.client').NotificationRow[]
}

// ── Unread count for badge ───────────────────────────────────────────────────
export async function getUnreadCount(userId: string, orgId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .is('read_at', null)
  return count ?? 0
}

// ── Mark a single notification read ─────────────────────────────────────────
export async function markNotificationRead(notifId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
    .is('read_at', null)
}

// ── Mark all notifications read for a user ───────────────────────────────────
export async function markAllNotificationsRead(userId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .is('read_at', null)
}
