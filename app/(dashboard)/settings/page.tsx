import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { getOrgSettingsWithDefaults, getOrgBankAccounts } from '@/lib/data/settings'
import SettingsClient from './settings-client'
import type { UserRole } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!session.user.role) redirect('/pending')

  const orgId = session.user.orgId
  const supabase = createAdminClient()

  const [orgSettings, userRow, bankAccounts] = await Promise.all([
    getOrgSettingsWithDefaults(orgId),
    supabase
      .from('users')
      .select('email_notifications, notification_prefs')
      .eq('id', session.user.id)
      .maybeSingle(),
    getOrgBankAccounts(orgId),
  ])

  const userData = userRow.data as {
    email_notifications: boolean
    notification_prefs: Record<string, boolean> | null
  } | null

  const emailNotifications = userData?.email_notifications ?? true
  const notificationPrefs = userData?.notification_prefs ?? {}

  return (
    <SettingsClient
      orgSettings={orgSettings}
      emailNotifications={emailNotifications}
      notificationPrefs={notificationPrefs}
      role={session.user.role as UserRole}
      bankAccounts={bankAccounts}
    />
  )
}
