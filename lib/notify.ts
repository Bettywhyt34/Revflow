'use server'

// ── Core notification helper ────────────────────────────────────────────────
// Inserts in-app notification rows AND sends branded emails to eligible users.

import { createAdminClient } from '@/lib/supabase/server'
import { buildNotificationEmailHtml } from '@/lib/email/notification-email'
import type { NotificationType, NotifPrefs } from '@/lib/data/notifications.client'
import { Resend } from 'resend'

export interface NotifyTarget {
  userId: string | null  // null = org-wide in-app broadcast (no email)
  email?: string | null  // explicit email override; if omitted, looked up from DB
}

export interface NotifyInput {
  orgId: string
  campaignId?: string | null
  type: NotificationType
  title: string
  message: string
  /** Path relative to app root, e.g. '/campaigns/uuid' */
  actionPath?: string | null
  targets: NotifyTarget[]
}

interface OrgBrand {
  org_name: string | null
  primary_color: string | null
  logo_url: string | null
}

/**
 * Insert notification rows and send emails.
 * - In-app: always inserted (per-user rows + optional org-wide broadcast)
 * - Email: sent only when user has email_notifications=true and the type is
 *   enabled in their notification_prefs
 */
export async function notify(input: NotifyInput): Promise<void> {
  const supabase = createAdminClient()

  // Build action_url
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const actionUrl = input.actionPath ? `${baseUrl}${input.actionPath}` : null

  // Insert notification rows for all targets
  const rows = input.targets.map((t) => ({
    org_id: input.orgId,
    user_id: t.userId,
    campaign_id: input.campaignId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    action_url: actionUrl,
  }))

  if (rows.length > 0) {
    await supabase.from('notifications').insert(rows)
  }

  // Collect user IDs that need email (skip org-wide broadcasts — no email target)
  const emailTargets = input.targets.filter(
    (t): t is NotifyTarget & { userId: string } => t.userId !== null,
  )
  if (emailTargets.length === 0) return

  // Fetch user records: email, email_notifications, notification_prefs
  const userIds = emailTargets.map((t) => t.userId)
  const { data: userRows } = await supabase
    .from('users')
    .select('id, email, email_notifications, notification_prefs')
    .in('id', userIds)

  if (!userRows || userRows.length === 0) return

  // Fetch org brand settings for email template
  const { data: orgSettingsRow } = await supabase
    .from('org_settings')
    .select('org_name, primary_color, logo_url')
    .eq('org_id', input.orgId)
    .maybeSingle()

  const brand: OrgBrand = {
    org_name: (orgSettingsRow as OrgBrand | null)?.org_name ?? 'Revflow',
    primary_color: (orgSettingsRow as OrgBrand | null)?.primary_color ?? '#0D9488',
    logo_url: (orgSettingsRow as OrgBrand | null)?.logo_url ?? null,
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'notifications@revflowapp.com'

  const html = buildNotificationEmailHtml({
    orgName: brand.org_name ?? 'Revflow',
    orgLogoUrl: brand.logo_url,
    primaryColor: brand.primary_color ?? '#0D9488',
    title: input.title,
    message: input.message,
    actionUrl,
  })

  for (const user of userRows) {
    const u = user as {
      id: string
      email: string | null
      email_notifications: boolean
      notification_prefs: Partial<NotifPrefs> | null
    }

    // Skip if email notifications are off globally
    if (!u.email_notifications) continue

    // Skip if this notification type is disabled in per-type prefs
    const prefs = u.notification_prefs ?? {}
    if (input.type in prefs && prefs[input.type as keyof NotifPrefs] === false) continue

    // Find the target's email (explicit override > DB email)
    const targetEmail = emailTargets.find((t) => t.userId === u.id)?.email ?? u.email
    if (!targetEmail) continue

    await resend.emails.send({
      from: fromEmail,
      to: targetEmail,
      subject: `${input.title} — ${brand.org_name ?? 'Revflow'}`,
      html,
    }).catch((err) => {
      console.error(`notify: failed to send email to ${targetEmail}:`, err)
    })
  }
}

// ── Convenience: notify all users with a given role in an org ────────────────
export async function notifyRole(
  orgId: string,
  role: 'admin' | 'finance_exec' | 'planner' | 'compliance',
  payload: Omit<NotifyInput, 'orgId' | 'targets'>,
): Promise<void> {
  const supabase = createAdminClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .eq('org_id', orgId)
    .eq('role', role)

  if (!users || users.length === 0) return

  await notify({
    ...payload,
    orgId,
    targets: users.map((u) => ({ userId: u.id, email: u.email ?? undefined })),
  })
}

// ── Convenience: notify specific users + optionally add org-wide broadcast ───
export async function notifyUsers(
  orgId: string,
  userIds: string[],
  payload: Omit<NotifyInput, 'orgId' | 'targets'>,
  includeBroadcast = false,
): Promise<void> {
  const supabase = createAdminClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', userIds)

  const targets: NotifyTarget[] = (users ?? []).map((u) => ({
    userId: u.id,
    email: u.email ?? undefined,
  }))

  if (includeBroadcast) {
    targets.push({ userId: null })
  }

  await notify({ ...payload, orgId, targets })
}
