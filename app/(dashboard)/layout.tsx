import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) redirect('/login')
  if (!session.user?.role) redirect('/pending')

  return (
    <div className="min-h-screen bg-background">
      {/* Full nav shell added in Step 13 */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
