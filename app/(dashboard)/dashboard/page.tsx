import { auth } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Revflow</h1>
        <p className="text-muted-foreground">
          AR &amp; Campaign Billing Platform — signed in as{' '}
          <span className="font-medium text-foreground">{session?.user?.name}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Dashboard will be built in Step 13.
        </p>
      </div>
    </div>
  )
}
