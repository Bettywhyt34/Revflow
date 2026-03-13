'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()

  // Refresh session on window focus — picks up role assignment by admin
  useEffect(() => {
    const handleFocus = async () => {
      await update()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [update])

  // Redirect once role is assigned
  useEffect(() => {
    if (session?.user?.role) {
      router.push('/dashboard')
    }
  }, [session?.user?.role, router])

  return (
    <Card className="w-full max-w-md text-center shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Clock className="size-6 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="text-xl">Account Pending Approval</CardTitle>
        <CardDescription className="text-sm">
          Your account has been created and is awaiting role assignment.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          An administrator will assign your role shortly. This page will automatically
          redirect you once access has been granted.
        </p>

        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session?.user?.email}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign out
        </Button>
      </CardContent>
    </Card>
  )
}
