'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  X,
  CheckCheck,
  DollarSign,
  AlertCircle,
  FileText,
  ShieldCheck,
  Zap,
  Clock,
} from 'lucide-react'
import type { NotificationRow, NotificationType } from '@/lib/data/notifications'

// ── Type icon map ─────────────────────────────────────────────────────────────
function TypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  const cls = className ?? 'h-4 w-4'
  switch (type) {
    case 'payment_received': return <DollarSign className={cls} />
    case 'invoice_due':       return <Clock className={cls} />
    case 'approval_required': return <AlertCircle className={cls} />
    case 'compliance':        return <ShieldCheck className={cls} />
    case 'chase':             return <Zap className={cls} />
    default:                  return <FileText className={cls} />
  }
}

const TYPE_COLORS: Record<NotificationType, string> = {
  payment_received:  'bg-green-100 text-green-600',
  invoice_due:       'bg-amber-100 text-amber-600',
  approval_required: 'bg-blue-100 text-blue-600',
  compliance:        'bg-purple-100 text-purple-600',
  chase:             'bg-orange-100 text-orange-600',
  system:            'bg-gray-100 text-gray-500',
}

// ── Time-ago helper ───────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Notification Bell ─────────────────────────────────────────────────────────
export default function NotificationBell({ primaryColor }: { primaryColor: string }) {
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Poll unread count ───────────────────────────────────────────────────────
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread', { cache: 'no-store' })
      const data = await res.json() as { count: number }
      setUnread(data.count ?? 0)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 60_000)
    const onFocus = () => fetchUnread()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [fetchUnread])

  // ── Fetch notifications when dropdown opens ──────────────────────────────────
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/notifications/list', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { notifications: NotificationRow[] }) => {
        setNotifications(data.notifications ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Mark single read + navigate ──────────────────────────────────────────────
  async function handleClick(n: NotificationRow) {
    if (!n.read_at) {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      })
      setNotifications((prev) =>
        prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x),
      )
      setUnread((c) => Math.max(0, c - 1))
    }
    if (n.action_url) {
      // action_url is absolute; extract pathname for router.push
      try {
        const url = new URL(n.action_url)
        router.push(url.pathname)
      } catch {
        router.push(n.action_url)
      }
    }
    setOpen(false)
  }

  // ── Mark all read ────────────────────────────────────────────────────────────
  async function handleMarkAllRead() {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    setUnread(0)
  }

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none"
            style={{ background: primaryColor }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(380px,90vw)] bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[520px]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 px-2 py-1 rounded-lg hover:bg-teal-50 transition min-h-[32px]"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                Loading…
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <Bell className="h-8 w-8 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            )}

            {!loading && notifications.map((n) => {
              const isUnread = !n.read_at
              const colorCls = TYPE_COLORS[n.type] ?? 'bg-gray-100 text-gray-500'
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-b-0 ${
                    isUnread ? 'bg-teal-50/30' : ''
                  }`}
                >
                  {/* Type icon */}
                  <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${colorCls}`}>
                    <TypeIcon type={n.type} className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: primaryColor }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
            <a
              href="/settings"
              className="text-xs text-gray-400 hover:text-teal-600 transition"
              onClick={() => setOpen(false)}
            >
              Manage notification preferences →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
