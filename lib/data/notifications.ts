import { createAdminClient } from '@/lib/supabase'

export type NotificationType =
  | 'invoice_due'
  | 'payment_received'
  | 'approval_required'
  | 'chase'
  | 'system'
  | 'compliance'

export interface NotificationRow {
  id: string
  org_id: string
  user_id: string | null
  campaign_id: string | null
  type: NotificationType
  title: string
  message: string
  action_url: string | null
  read_at: string | null
  created_at: string
}

export interface NotifPrefs {
  payment_received: boolean
  approval_required: boolean
  invoice_due: boolean
  chase: boolean
  system: boolean
  compliance: boolean
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  payment_received: true,
  approval_required: true,
  invoice_due: true,
  chase: true,
  system: true,
  compliance: true,
}

// ── Fetch notifications for a user (own + org-wide broadcasts) ───────────────
export async function getNotifications(
  userId: string,
  orgId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, org_id, user_id, campaign_id, type, title, message, action_url, read_at, created_at')
    .eq('org_id', orgId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as NotificationRow[]
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
