import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/app-shell'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
import type { UserRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) redirect('/login')
  if (!session.user?.role) redirect('/pending')

  const orgSettings = await getOrgSettingsWithDefaults(session.user.orgId)

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role as UserRole,
      }}
      primaryColor={orgSettings.primary_color}
    >
      {children}
    </AppShell>
  )
}
