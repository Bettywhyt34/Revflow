import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BarChart3, Receipt, TrendingUp, FileSpreadsheet } from 'lucide-react'
import type { UserRole } from '@/types'

export const metadata = { title: 'Reports — Revflow' }

const REPORT_CARDS = [
  {
    href: '/reports/wht-credits',
    icon: Receipt,
    iconBg: 'bg-amber-50 group-hover:bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'WHT Credits',
    subtitle: 'Withholding tax register',
    description: 'Track WHT deducted by clients on all payments. Filter by year, client, and status.',
  },
  {
    href: '/reports/ar-aging',
    icon: BarChart3,
    iconBg: 'bg-blue-50 group-hover:bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'AR Aging',
    subtitle: 'Outstanding receivables by age',
    description: 'Outstanding invoices grouped by age bucket: 0-30, 31-60, 61-90, 90+ days.',
  },
  {
    href: '/reports/revenue',
    icon: TrendingUp,
    iconBg: 'bg-teal-50 group-hover:bg-teal-100',
    iconColor: 'text-teal-600',
    title: 'Revenue Summary',
    subtitle: 'Monthly planned vs collected',
    description: 'Month-by-month revenue breakdown with collection rates and write-off totals.',
  },
  {
    href: '/reports/campaigns',
    icon: FileSpreadsheet,
    iconBg: 'bg-violet-50 group-hover:bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Campaign Export',
    subtitle: 'Full campaign summary',
    description: 'All campaigns with planned, billed, collected, and balance figures. Exportable to Excel.',
  },
]

export default async function ReportsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userRole = (session.user.role ?? '') as UserRole
  if (userRole !== 'admin' && userRole !== 'finance_exec') {
    redirect('/dashboard')
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Financial reports and analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center transition-colors`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                  <p className="text-xs text-gray-400">{card.subtitle}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{card.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
