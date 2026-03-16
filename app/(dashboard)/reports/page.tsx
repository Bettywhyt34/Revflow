import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BarChart3, Receipt } from 'lucide-react'
import type { UserRole } from '@/types'

export const metadata = { title: 'Reports — Revflow' }

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = session.user.role as UserRole

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Financial reports and analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(userRole === 'admin' || userRole === 'finance_exec') && (
          <Link
            href="/reports/wht-credits"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">WHT Credits</p>
                <p className="text-xs text-gray-400">Withholding tax register</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Track WHT deducted by clients on all payments. Filter by year, client, and status.
            </p>
          </Link>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5 opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AR Aging</p>
              <p className="text-xs text-gray-400">Coming soon</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Outstanding invoices grouped by age and client.
          </p>
        </div>
      </div>
    </div>
  )
}
