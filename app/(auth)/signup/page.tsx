'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

type Path = 'create_org' | 'join_org'

export default function SignupPage() {
  const router = useRouter()
  const [path, setPath] = useState<Path>('create_org')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // create_org
  const [companyName, setCompanyName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // join_org
  const [inviteCode, setInviteCode] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, fullName, email, password, confirmPassword, companyName, inviteCode }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }

    // Success — redirect to login with a flag so login page can show a message
    router.push('/login?registered=1')
  }

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">R</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Revflow</span>
        </div>
        <CardTitle className="text-lg font-semibold">Create your account</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          AR &amp; Campaign Billing Platform
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Path toggle */}
        <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => { setPath('create_org'); setError(null) }}
            className={`flex-1 py-2 transition-colors ${
              path === 'create_org'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            New organisation
          </button>
          <button
            type="button"
            onClick={() => { setPath('join_org'); setError(null) }}
            className={`flex-1 py-2 transition-colors ${
              path === 'join_org'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Join with invite
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* create_org only */}
          {path === 'create_org' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="QVT Media"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>
          )}

          {/* join_org only */}
          {path === 'join_org' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inviteCode">Invite Code</Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                autoComplete="off"
                className="uppercase tracking-widest"
              />
            </div>
          )}

          {/* Shared fields */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Your Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {/* create_org only */}
          {path === 'create_org' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {path === 'join_org' && (
            <p className="text-xs text-muted-foreground">
              Your account will be pending until an admin assigns you a role.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? 'Creating account…'
              : path === 'create_org'
              ? 'Create organisation'
              : 'Join organisation'}
          </Button>
        </form>

        <Separator />

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
