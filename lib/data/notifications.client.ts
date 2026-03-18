/**
 * Client-safe notification types and constants.
 * Safe to import in Client Components — no server dependencies.
 */

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
