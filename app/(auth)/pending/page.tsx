'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Clock } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()

  // Refresh session when user returns to tab (picks up role assignment by admin)
  useEffect(() => {
    const handleFocus = async () => { await update() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [update])

  // Auto-redirect once role is assigned
  useEffect(() => {
    if (session?.user?.role) router.push('/dashboard')
  }, [session?.user?.role, router])

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Icon */}
      <div
        className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(13,148,136,0.1)' }}
      >
        <Clock className="h-7 w-7" style={{ color: '#0D9488' }} />
      </div>

      {/* Copy */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Account Pending</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
          Your account is pending approval. Contact your administrator to get access.
        </p>
      </div>

      {/* Email pill */}
      {session?.user?.email && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-600">
          Signed in as{' '}
          <span className="font-semibold text-gray-900">{session.user.email}</span>
        </div>
      )}

      <p className="text-xs text-gray-400">
        This page will redirect automatically once access is granted.
      </p>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="min-h-[44px] px-6 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
      >
        Sign out
      </button>
    </div>
  )
}
