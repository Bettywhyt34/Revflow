'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@/types'
import { OrgSettingsProvider, useOrgSettings, type OrgBrandState } from './org-settings-context'
import NotificationBell from '@/components/notifications/notification-bell'

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  allowedRoles: UserRole[] | null
}[] = [
  { label: 'Dashboard', href: '/dashboard',   icon: LayoutDashboard, active: true, allowedRoles: null },
  { label: 'Campaigns', href: '/campaigns',   icon: Briefcase,       active: true, allowedRoles: null },
  { label: 'Clients',   href: '/clients',     icon: Building2,       active: true, allowedRoles: ['admin', 'finance_exec', 'planner'] },
  { label: 'Reports',   href: '/reports',     icon: BarChart3,       active: true, allowedRoles: ['admin', 'finance_exec'] },
  { label: 'Users',     href: '/admin/users', icon: Users,           active: true, allowedRoles: ['admin'] },
  { label: 'Settings',  href: '/settings',    icon: Settings,        active: true, allowedRoles: ['admin', 'finance_exec'] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function roleLabel(role: UserRole | null): string {
  if (!role) return 'Pending'
  const map: Record<UserRole, string> = {
    admin: 'Admin',
    planner: 'Planner',
    finance_exec: 'Finance Exec',
    compliance: 'Compliance',
  }
  return map[role]
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function isNavAllowed(item: (typeof NAV_ITEMS)[0], role: UserRole | null): boolean {
  if (!item.allowedRoles) return true
  if (!role) return false
  return item.allowedRoles.includes(role)
}

function getBottomTabs(role: UserRole | null) {
  return NAV_ITEMS.filter((n) => n.active && isNavAllowed(n, role))
}

// ── Logo mark — shows org logo or branded "R" fallback ──────────────────────
function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { primaryColor, logoUrl, orgName } = useOrgSettings()
  const dim = size === 'sm' ? 'h-7 w-7 rounded-md text-xs' : 'h-8 w-8 rounded-lg text-sm'

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={orgName}
        className={`${size === 'sm' ? 'h-7' : 'h-8'} w-auto max-w-[80px] object-contain flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${dim} flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ background: primaryColor }}
    >
      {orgName.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Sidebar nav links ─────────────────────────────────────────────────────────
function SidebarNavLinks({
  user,
  pathname,
  onClose,
}: {
  user: { name?: string | null; email?: string | null; role: UserRole | null }
  pathname: string
  onClose?: () => void
}) {
  const router = useRouter()
  const { primaryColor, orgName } = useOrgSettings()

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mobile overlay header — logo + close button */}
      {onClose && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark size="sm" />
            <span className="text-sm font-bold text-gray-900 truncate">{orgName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter((item) => isNavAllowed(item, user.role)).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          if (!item.active) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 cursor-not-allowed select-none"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={isActive ? { background: primaryColor } : {}}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />}
            </Link>
          )
        })}
      </nav>

      {/* Mobile overlay footer — sign out */}
      {onClose && (
        <div className="border-t border-gray-100 px-3 py-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
function MobileBottomNav({
  pathname,
  role,
}: {
  pathname: string
  role: UserRole | null
}) {
  const { primaryColor } = useOrgSettings()
  const tabs = getBottomTabs(role)
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex safe-bottom">
      {tabs.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors"
            style={isActive ? { color: primaryColor } : { color: '#9ca3af' }}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

// ── Top navbar ────────────────────────────────────────────────────────────────
// Visible on ALL screen sizes.
// Layout: [hamburger(mobile) + Logo + OrgName(sm+)] | [Page Title(sm+)] | [Bell + Avatar + Name(sm+) + Signout(sm+)]
function TopBar({
  user,
  onMenuOpen,
}: {
  user: { name?: string | null; role: UserRole | null }
  onMenuOpen: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { primaryColor, orgName } = useOrgSettings()

  const pageTitle =
    pathname === '/dashboard'
      ? 'Dashboard'
      : pathname.startsWith('/campaigns/new')
      ? 'New Campaign'
      : pathname.startsWith('/campaigns/')
      ? 'Campaign'
      : pathname.startsWith('/campaigns')
      ? 'Campaigns'
      : pathname.startsWith('/clients/new')
      ? 'New Client'
      : pathname.startsWith('/clients/')
      ? 'Client'
      : pathname.startsWith('/clients')
      ? 'Clients'
      : pathname.startsWith('/settings')
      ? 'Settings'
      : pathname.startsWith('/reports/wht-credits')
      ? 'WHT Credits'
      : pathname.startsWith('/reports')
      ? 'Reports'
      : pathname.startsWith('/admin')
      ? 'Admin'
      : 'Revflow'

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3">

      {/* LEFT — hamburger (mobile) + Logo + OrgName */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMenuOpen}
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <LogoMark size="sm" />
        {/* Hide org name on mobile */}
        <span className="hidden sm:block text-sm font-bold text-gray-900 whitespace-nowrap">
          {orgName}
        </span>
      </div>

      {/* CENTER — Page title (hidden on mobile) */}
      <div className="flex-1 flex justify-center">
        <span className="hidden sm:block text-sm font-semibold text-gray-600 truncate max-w-xs">
          {pageTitle}
        </span>
      </div>

      {/* RIGHT — Bell + Avatar + Name/Role + Sign out */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <NotificationBell primaryColor={primaryColor} />

        {/* Avatar + Name + Role */}
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: primaryColor }}
          >
            {initials(user.name)}
          </div>
          {/* Name + role hidden on mobile */}
          <div className="hidden sm:block leading-none">
            <p className="text-sm font-medium text-gray-900">{user.name ?? 'User'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{roleLabel(user.role)}</p>
          </div>
        </div>

        {/* Sign out — hidden on mobile (accessible via sidebar overlay) */}
        <button
          onClick={handleSignOut}
          className="hidden sm:flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px]"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────
export default function AppShell({
  user,
  children,
  orgSettings,
}: {
  user: { name?: string | null; email?: string | null; role: UserRole | null }
  children: React.ReactNode
  orgSettings: OrgBrandState
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <OrgSettingsProvider initial={orgSettings}>
      <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">

        {/* Top navbar — all screens */}
        <TopBar user={user} onMenuOpen={() => setSidebarOpen(true)} />

        {/* Body row: sidebar + main */}
        <div className="flex flex-1 min-h-0">

          {/* Desktop sidebar — nav links only */}
          <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:flex-shrink-0 bg-white border-r border-gray-100 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
            <SidebarNavLinks user={user} pathname={pathname} />
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-40 flex">
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="relative z-50 w-72 max-w-[85vw] bg-white h-full shadow-xl">
                <SidebarNavLinks
                  user={user}
                  pathname={pathname}
                  onClose={() => setSidebarOpen(false)}
                />
              </aside>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-x-hidden pb-20 lg:pb-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileBottomNav pathname={pathname} role={user.role} />
      </div>
    </OrgSettingsProvider>
  )
}
