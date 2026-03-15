import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getClients } from '@/lib/data/clients'
import type { UserRole } from '@/types'
import ClientsTable from './clients-table'

export const metadata = { title: 'Clients — Revflow' }

export default async function ClientsPage() {
  const session = await auth()
  const orgId = session!.user.orgId
  const role = session!.user.role as UserRole

  const clients = await getClients(orgId)

  const canCreate = role === 'admin' || role === 'planner' || role === 'finance_exec'

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg
              text-sm font-semibold text-white transition whitespace-nowrap"
            style={{ background: '#0D9488' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        )}
      </div>

      <ClientsTable clients={clients} />
    </div>
  )
}
