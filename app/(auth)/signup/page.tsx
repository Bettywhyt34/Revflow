'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail } from 'lucide-react'

type Path = 'create_org' | 'join_org'

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteParam = searchParams.get('invite')

  // When ?invite=TOKEN is present, lock to join_org path
  const isInviteFlow = !!inviteParam
  const [path, setPath] = useState<Path>(isInviteFlow ? 'join_org' : 'create_org')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // create_org
  const [companyName, setCompanyName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Sync path if invite param changes
  useEffect(() => {
    if (inviteParam) setPath('join_org')
  }, [inviteParam])

  function switchPath(p: Path) {
    if (isInviteFlow) return // locked when invite is in URL
    setPath(p)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const body =
      path === 'create_org'
        ? { path, fullName, email, password, confirmPassword, companyName }
        : { path, fullName, email, password, inviteToken: inviteParam ?? '' }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }

    router.push('/login?registered=1')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          {isInviteFlow ? 'Accept your invitation' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isInviteFlow
            ? 'Fill in your details to join your organisation'
            : 'Get started with Revflow'}
        </p>
      </div>

      {/* Invite banner */}
      {isInviteFlow && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <Mail className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-teal-800">
            You&apos;ve been invited to join an organisation. Your role will be assigned
            automatically when you sign up.
          </p>
        </div>
      )}

      {/* Path toggle — hidden in invite flow */}
      {!isInviteFlow && (
        <div className="flex rounded-lg border border-gray-200 p-1 gap-1 bg-gray-50 text-sm font-medium">
          <button
            type="button"
            onClick={() => switchPath('create_org')}
            className="flex-1 min-h-[44px] rounded-md py-2 transition-all"
            style={
              path === 'create_org'
                ? { background: '#0D9488', color: '#ffffff', boxShadow: '0 1px 3px rgba(13,148,136,0.3)' }
                : { color: '#6b7280' }
            }
          >
            New organisation
          </button>
          <button
            type="button"
            onClick={() => switchPath('join_org')}
            className="flex-1 min-h-[44px] rounded-md py-2 transition-all"
            style={
              path === 'join_org'
                ? { background: '#0D9488', color: '#ffffff', boxShadow: '0 1px 3px rgba(13,148,136,0.3)' }
                : { color: '#6b7280' }
            }
          >
            Join with invite
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* create_org only */}
        {path === 'create_org' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="companyName" className="text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              id="companyName"
              type="text"
              placeholder="QVT Media"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoComplete="organization"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
            Your Name
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </div>

        {/* create_org only */}
        {path === 'create_org' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
        )}

        {/* join_org without invite URL — shouldn't happen in normal flow */}
        {path === 'join_org' && !isInviteFlow && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
            You need an invite link from your administrator to join an organisation.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || (path === 'join_org' && !isInviteFlow)}
          className="mt-1 w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
          style={{ background: loading ? '#0b857a' : '#0D9488' }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0b857a' }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#0D9488' }}
        >
          {loading
            ? 'Creating account…'
            : path === 'create_org'
            ? 'Create organisation'
            : 'Join organisation'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#0D9488] hover:underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
