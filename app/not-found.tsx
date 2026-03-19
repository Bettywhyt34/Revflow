import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
            <FileQuestion className="h-7 w-7 text-gray-400" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Page not found</h1>
          <p className="text-sm text-gray-500 mt-1">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors w-full"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
