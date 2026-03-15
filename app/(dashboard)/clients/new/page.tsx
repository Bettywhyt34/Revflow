import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { UserRole } from '@/types'
import NewClientForm from './new-client-form'

export const metadata = { title: 'New Client — Revflow' }

export default async function NewClientPage() {
  const session = await auth()
  const role = session!.user.role as UserRole

  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') {
    redirect('/clients')
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Client</h1>
        <p className="text-sm text-gray-500 mt-0.5">Add a client to use across campaigns and documents</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NewClientForm />
      </div>
    </div>
  )
}
