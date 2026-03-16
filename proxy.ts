import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isLoggedIn = !!session
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null

  // Always allow auth API routes and public API routes
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/invite')) {
    return NextResponse.next()
  }

  // ── /login ────────────────────────────────────────────────────────────
  if (pathname === '/login' || pathname.startsWith('/login')) {
    if (!isLoggedIn) return NextResponse.next()
    return NextResponse.redirect(new URL(role ? '/dashboard' : '/pending', req.url))
  }

  // ── /signup ───────────────────────────────────────────────────────────
  if (pathname === '/signup' || pathname.startsWith('/signup')) {
    if (!isLoggedIn) return NextResponse.next()
    return NextResponse.redirect(new URL(role ? '/dashboard' : '/pending', req.url))
  }

  // ── /pending ──────────────────────────────────────────────────────────
  if (pathname === '/pending') {
    if (!isLoggedIn) return NextResponse.redirect(new URL('/login', req.url))
    if (role) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }

  // ── All other routes require authentication + role ────────────────────
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (!role) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  // ── Role-based route guards ───────────────────────────────────────────
  const dash = new URL('/dashboard', req.url)

  // Admin only: user management
  if (pathname.startsWith('/admin/') && role !== 'admin') {
    return NextResponse.redirect(dash)
  }

  // Admin + Finance Exec only: reports, settings
  if (
    (pathname.startsWith('/reports') || pathname.startsWith('/settings')) &&
    role !== 'admin' && role !== 'finance_exec'
  ) {
    return NextResponse.redirect(dash)
  }

  // Not accessible to Compliance: clients, campaign creation
  if (role === 'compliance') {
    if (pathname.startsWith('/clients') || pathname === '/campaigns/new') {
      return NextResponse.redirect(dash)
    }
  }

  // Not accessible to Planner or Compliance: proforma/invoice create & edit
  if (role === 'planner' || role === 'compliance') {
    if (
      pathname.match(/\/campaigns\/[^/]+\/proforma\//) ||
      pathname.match(/\/campaigns\/[^/]+\/invoice\//)
    ) {
      return NextResponse.redirect(dash)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
