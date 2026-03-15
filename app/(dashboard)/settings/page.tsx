import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
import SettingsClient from './settings-client'
import type { UserRole } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!session.user.role) redirect('/pending')

  const orgId = session.user.orgId
  const supabase = createAdminClient()

  const [orgSettings, userRow] = await Promise.all([
    getOrgSettingsWithDefaults(orgId),
    supabase
      .from('users')
      .select('email_notifications')
      .eq('id', session.user.id)
      .maybeSingle(),
  ])

  const emailNotifications = (userRow.data as { email_notifications: boolean } | null)
    ?.email_notifications ?? true

  return (
    <SettingsClient
      orgSettings={orgSettings}
      emailNotifications={emailNotifications}
      role={session.user.role as UserRole}
    />
  )
}
