import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side Supabase client (uses cookies for auth context, respects RLS).
 * Use in Server Components and Route Handlers.
 */
export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component — cookie writes are a no-op
        }
      },
    },
  })
}

/**
 * Browser-side Supabase client (anon key, respects RLS).
 * Use in Client Components.
 */
export function createBrowserClient() {
  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Admin Supabase client (service role key, bypasses RLS).
 * Use ONLY in server-side code for privileged operations.
 */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
