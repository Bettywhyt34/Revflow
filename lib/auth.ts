import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { createAdminClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Zoho OAuth provider (stubbed — wired up in Step 15)
// ---------------------------------------------------------------------------
function ZohoProvider(options: { clientId: string; clientSecret: string }) {
  return {
    id: 'zoho',
    name: 'Zoho',
    type: 'oauth' as const,
    authorization: {
      url: 'https://accounts.zoho.com/oauth/v2/auth',
      params: { scope: 'AaaServer.profile.Read', response_type: 'code' },
    },
    token: 'https://accounts.zoho.com/oauth/v2/token',
    userinfo: 'https://accounts.zoho.com/oauth/v2/userinfo',
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    profile(profile: Record<string, unknown>) {
      return {
        id: String(profile['ZSUID'] ?? profile['sub'] ?? ''),
        name: String(profile['display_name'] ?? profile['name'] ?? ''),
        email: String(profile['Email'] ?? profile['email'] ?? ''),
        image: null,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Auth config
// ---------------------------------------------------------------------------
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: process.env.AZURE_AD_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
        : 'https://login.microsoftonline.com/common/v2.0',
    }),
    ZohoProvider({
      clientId: process.env.ZOHO_CLIENT_ID ?? '',
      clientSecret: process.env.ZOHO_CLIENT_SECRET ?? '',
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    // ------------------------------------------------------------------
    // signIn — upsert user into Supabase after OAuth success
    // ------------------------------------------------------------------
    async signIn({ user }) {
      if (!user.email) return false

      const supabase = createAdminClient()

      try {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle()

        if (existingUser) {
          // Returning user — update last_login
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', existingUser.id)
          return true
        }

        // New user — check total count to decide role
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        let orgId: string
        let userRole: string | null

        if ((count ?? 0) === 0) {
          // Bootstrap: first user ever → create org + make admin
          const { data: org, error: orgError } = await supabase
            .from('organisations')
            .insert({
              name: 'QVT Media',
              country: 'NG',
              default_currency: 'NGN',
            })
            .select('id')
            .single()

          if (orgError || !org) {
            console.error('Failed to create org:', orgError)
            return false
          }
          orgId = org.id
          userRole = 'admin'
        } else {
          // Subsequent user — get existing org, set role to null (pending)
          const { data: org } = await supabase
            .from('organisations')
            .select('id')
            .limit(1)
            .maybeSingle()

          if (!org) {
            console.error('No organisation found')
            return false
          }
          orgId = org.id
          userRole = null
        }

        // Insert new user
        const { error: insertError } = await supabase.from('users').insert({
          email: user.email,
          full_name: user.name ?? '',
          avatar_url: user.image ?? null,
          role: userRole,
          org_id: orgId,
        })

        if (insertError) {
          console.error('Failed to insert user:', insertError)
          return false
        }

        return true
      } catch (err) {
        console.error('signIn callback error:', err)
        return false
      }
    },

    // ------------------------------------------------------------------
    // jwt — attach userId, role, orgId to token on sign-in or update
    // ------------------------------------------------------------------
    async jwt({ token, user, trigger }) {
      const shouldRefresh = !!user?.email || trigger === 'update'
      if (!shouldRefresh) return token

      const email = user?.email ?? token.email
      if (!email) return token

      const supabase = createAdminClient()
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, role, org_id')
        .eq('email', email)
        .maybeSingle()

      if (dbUser) {
        token.userId = dbUser.id
        token.role = dbUser.role
        token.orgId = dbUser.org_id
      }

      return token
    },

    // ------------------------------------------------------------------
    // session — expose userId, role, orgId on session object
    // ------------------------------------------------------------------
    async session({ session, token }) {
      if (token) {
        session.user.id = (token.userId as string | undefined) ?? ''
        session.user.role = (token.role as string | null | undefined) ?? null
        session.user.orgId = (token.orgId as string | undefined) ?? ''
      }
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
