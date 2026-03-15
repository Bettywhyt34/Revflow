'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, Plus, Trash2, UserCog } from 'lucide-react'
import { updateUserRoleAction, createInviteTokenAction, revokeInviteAction } from '@/lib/actions/users'
import type { UserRole } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_OPTIONS: { value: UserRole | 'pending'; label: string }[] = [
  { value: 'admin',        label: 'Admin' },
  { value: 'planner',      label: 'Planner' },
  { value: 'finance_exec', label: 'Finance Exec' },
  { value: 'compliance',   label: 'Compliance' },
  { value: 'pending',      label: 'Pending (no access)' },
]

const INVITE_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'planner',      label: 'Planner',      description: 'Create campaigns, upload plans' },
  { value: 'finance_exec', label: 'Finance Exec',  description: 'Proforma, invoices, payments' },
  { value: 'compliance',   label: 'Compliance',    description: 'Upload compliance documents' },
  { value: 'admin',        label: 'Admin',         description: 'Full access' },
]

function roleBadgeClass(role: string | null): string {
  const map: Record<string, string> = {
    admin:        'bg-purple-50 text-purple-700 border border-purple-200',
    planner:      'bg-blue-50 text-blue-700 border border-blue-200',
    finance_exec: 'bg-teal-50 text-teal-700 border border-teal-200',
    compliance:   'bg-orange-50 text-orange-700 border border-orange-200',
  }
  return map[role ?? ''] ?? 'bg-gray-100 text-gray-500'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 1) return `${h}h ${m}m`
  return `${m}m`
}

// ── UserRoleRow ───────────────────────────────────────────────────────────────
function UserRoleRow({
  user,
  isSelf,
}: {
  user: { id: string; email: string; full_name: string; role: string | null; last_login: string | null; created_at: string }
  isSelf: boolean
}) {
  const [role, setRole] = useState<UserRole | 'pending'>((user.role as UserRole) ?? 'pending')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      setError(null)
      const result = await updateUserRoleAction(
        user.id,
        role === 'pending' ? null : (role as UserRole),
      )
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  const hasChanged = role !== ((user.role as UserRole) ?? 'pending')

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: '#0D9488' }}
          >
            {user.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.full_name}
              {isSelf && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
          {ROLE_OPTIONS.find(r => r.value === (user.role ?? 'pending'))?.label ?? 'Pending'}
        </span>
      </td>

      <td className="px-4 py-3.5 text-xs text-gray-400">
        {formatDate(user.last_login ?? user.created_at)}
      </td>

      <td className="px-4 py-3.5">
        {isSelf ? (
          <span className="text-xs text-gray-300">—</span>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value as UserRole | 'pending'); setError(null) }}
              className="min-h-[36px] text-sm rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 outline-none focus:border-[#0D9488] transition"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {hasChanged && (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-white transition disabled:opacity-60"
                style={{ background: saved ? '#16a34a' : '#0D9488' }}
              >
                {isPending ? '…' : saved ? <Check className="h-3.5 w-3.5" /> : 'Save'}
              </button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </td>
    </tr>
  )
}

// ── InviteGenerator ───────────────────────────────────────────────────────────
function InviteGenerator() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('planner')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      setError(null)
      setGeneratedLink(null)
      const result = await createInviteTokenAction(selectedRole)
      if ('error' in result) {
        setError(result.error)
      } else {
        const url = `${window.location.origin}/signup?invite=${result.token}`
        setGeneratedLink(url)
      }
    })
  }

  async function handleCopy() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Invite User</h2>
      </div>

      <p className="text-xs text-gray-500">
        Generate a one-time invite link valid for 48 hours. Send it via email, WhatsApp, or any channel.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-gray-500">Assign role</label>
          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value as UserRole); setGeneratedLink(null) }}
            className="w-full min-h-[44px] px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white outline-none focus:border-[#0D9488] transition"
          >
            {INVITE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60 whitespace-nowrap"
            style={{ background: '#0D9488' }}
            onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#0b857a' }}
            onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = '#0D9488' }}
          >
            <Plus className="h-4 w-4" />
            {isPending ? 'Generating…' : 'Generate Link'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      {generatedLink && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Invite link (valid 48 hours)</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={generatedLink}
              className="flex-1 min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-700 outline-none font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-gray-200 text-sm font-medium transition hover:bg-gray-50"
              style={copied ? { borderColor: '#0D9488', color: '#0D9488' } : { color: '#374151' }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-amber-600">
            Share this link manually — it can only be used once.
          </p>
        </div>
      )}
    </div>
  )
}

// ── ActiveInvitesList ─────────────────────────────────────────────────────────
function ActiveInvitesList({
  invites,
}: {
  invites: { id: string; code: string; role: string | null; expires_at: string | null; created_at: string }[]
}) {
  const [revoking, setRevoking] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleRevoke(id: string) {
    setRevoking(id)
    startTransition(async () => {
      await revokeInviteAction(id)
      setRevoking(null)
    })
  }

  if (invites.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">No active invite links</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Expires</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Token</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {invites.map((inv) => (
            <tr key={inv.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(inv.role)}`}>
                  {ROLE_OPTIONS.find(r => r.value === inv.role)?.label ?? inv.role}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {inv.expires_at ? (
                  <>
                    {formatDate(inv.expires_at)}{' '}
                    <span className="text-amber-500">({timeUntil(inv.expires_at)} left)</span>
                  </>
                ) : '—'}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[120px] truncate">
                {inv.code.slice(0, 8)}…
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleRevoke(inv.id)}
                  disabled={revoking === inv.id}
                  className="min-h-[36px] px-3 rounded-lg text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                >
                  {revoking === inv.id ? '…' : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────
export default function UsersClient({
  users,
  activeInvites,
  currentUserId,
}: {
  users: { id: string; email: string; full_name: string; role: string | null; last_login: string | null; created_at: string }[]
  activeInvites: { id: string; code: string; role: string | null; expires_at: string | null; created_at: string }[]
  currentUserId: string
}) {
  return (
    <div className="space-y-6">
      {/* Invite generator */}
      <InviteGenerator />

      {/* Team members */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Team Members
            <span className="ml-2 text-xs font-normal text-gray-400">({users.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Last Active</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRoleRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active invites */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Active Invites
            <span className="ml-2 text-xs font-normal text-gray-400">
              {activeInvites.length > 0 ? `(${activeInvites.length} pending)` : ''}
            </span>
          </h2>
        </div>
        <ActiveInvitesList invites={activeInvites} />
      </div>
    </div>
  )
}
