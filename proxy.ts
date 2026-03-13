import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isLoggedIn = !!session
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null

  // Always allow auth API routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // ── /login ───────────────────────────────────────────────────────────
  if (pathname === '/login' || pathname.startsWith('/login')) {
    if (!isLoggedIn) return NextResponse.next()
    // Logged in → send to appropriate destination
    return NextResponse.redirect(
      new URL(role ? '/dashboard' : '/pending', req.url)
    )
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

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
