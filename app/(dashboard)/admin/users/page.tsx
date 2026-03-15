import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrgUsers, getActiveInvites } from '@/lib/data/users'
import UsersClient from './users-client'

export const metadata = { title: 'User Management — Revflow' }

export default async function AdminUsersPage() {
  const session = await auth()
  if (session!.user.role !== 'admin') redirect('/dashboard')

  const orgId = session!.user.orgId
  const currentUserId = session!.user.id

  const [users, activeInvites] = await Promise.all([
    getOrgUsers(orgId),
    getActiveInvites(orgId),
  ])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage team members and invite new users to your organisation
        </p>
      </div>

      <UsersClient
        users={users}
        activeInvites={activeInvites}
        currentUserId={currentUserId}
      />
    </div>
  )
}
