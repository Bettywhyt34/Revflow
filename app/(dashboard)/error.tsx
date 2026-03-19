'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 mt-1">
            An unexpected error occurred. Try refreshing, or contact support if the issue persists.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-300 mt-2 font-mono">ID: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="min-h-[44px] px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors w-full"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
