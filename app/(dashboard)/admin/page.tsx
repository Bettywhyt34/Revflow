import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAdminPanelData } from '@/lib/data/dashboard'
import { Users, Settings, AlertTriangle, Upload, Activity } from 'lucide-react'

export const metadata = { title: 'Admin — Revflow' }

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  finance_exec: 'Finance Exec',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  finance_exec: 'bg-teal-100 text-teal-700',
  viewer: 'bg-gray-100 text-gray-600',
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'admin') redirect('/dashboard')

  const orgId = session.user.orgId
  const adminData = await getAdminPanelData(orgId)

  const recentUsers = adminData.userActivity.slice(0, 10)
  const pendingUsers = adminData.userActivity.filter((u) => u.role === 'pending')

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">System overview and management</p>
      </div>

      {/* Quick Links */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/admin/users"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 transition-all group flex items-center gap-4"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">User Management</p>
              <p className="text-xs text-gray-400">
                {adminData.userActivity.length} user{adminData.userActivity.length !== 1 ? 's' : ''}
                {pendingUsers.length > 0 ? ` · ${pendingUsers.length} pending` : ''}
              </p>
            </div>
          </Link>

          <Link
            href="/settings"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-teal-200 transition-all group flex items-center gap-4"
          >
            <div className="h-10 w-10 rounded-xl bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center transition-colors">
              <Settings className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Settings</p>
              <p className="text-xs text-gray-400">Organisation and system settings</p>
            </div>
          </Link>
        </div>
      </section>

      {/* System Health */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">System Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{adminData.userActivity.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Pending Invites</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{pendingUsers.length}</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 ${adminData.overrideAlerts.length > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-1.5">
              {adminData.overrideAlerts.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              <p className="text-xs text-gray-400">Override Alerts</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${adminData.overrideAlerts.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {adminData.overrideAlerts.length}
            </p>
          </div>
          <div className={`bg-white rounded-xl border p-4 ${adminData.failedUploads.length > 0 ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-center gap-1.5">
              {adminData.failedUploads.length > 0 && <Upload className="h-3.5 w-3.5 text-red-500" />}
              <p className="text-xs text-gray-400">Failed Uploads</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${adminData.failedUploads.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {adminData.failedUploads.length}
            </p>
          </div>
        </div>

        {/* Override Alerts */}
        {adminData.overrideAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Recent Override Alerts
            </p>
            <ul className="space-y-1.5">
              {adminData.overrideAlerts.slice(0, 5).map((a) => (
                <li key={a.id} className="text-xs text-amber-800 flex items-start gap-2">
                  <span className="text-amber-400 shrink-0">{new Date(a.created_at).toLocaleDateString('en-GB')}</span>
                  <span>{a.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Failed Uploads */}
        {adminData.failedUploads.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Failed Uploads
            </p>
            <ul className="space-y-1.5">
              {adminData.failedUploads.slice(0, 5).map((u) => (
                <li key={u.id} className="text-xs text-red-800 flex items-start gap-2">
                  <span className="text-red-400 shrink-0">{new Date(u.created_at).toLocaleDateString('en-GB')}</span>
                  <span className="font-mono">{u.file_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* User Activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Activity className="h-4 w-4" /> Recent User Activity
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{formatDate(u.last_login)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-right">
            <Link href="/admin/users" className="text-xs text-teal-600 hover:underline font-medium">
              Manage all users →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
