import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { signIn } from '@/lib/auth'
import { Chrome, AlertCircle } from 'lucide-react'

// Microsoft icon (no lucide equivalent — inline SVG)
function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#00a4ef" />
      <rect x="1" y="11" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

// Zoho icon (text-based fallback)
function ZohoIcon() {
  return (
    <span className="text-xs font-bold leading-none text-[#e42527]" aria-hidden="true">
      Z
    </span>
  )
}

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="text-center pb-4">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">R</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">Revflow</span>
        </div>
        <CardTitle className="text-lg font-semibold">Sign in to your account</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          AR &amp; Campaign Billing Platform
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Google */}
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/dashboard' })
          }}
        >
          <Button type="submit" variant="outline" className="w-full gap-2 h-10">
            <Chrome className="size-4" />
            Continue with Google
          </Button>
        </form>

        {/* Microsoft */}
        <form
          action={async () => {
            'use server'
            await signIn('microsoft-entra-id', { redirectTo: '/dashboard' })
          }}
        >
          <Button type="submit" variant="outline" className="w-full gap-2 h-10">
            <MicrosoftIcon />
            Continue with Microsoft
          </Button>
        </form>

        <Separator className="my-1" />

        {/* Zoho — disabled, coming soon */}
        <div className="relative group">
          <Button
            variant="outline"
            className="w-full gap-2 h-10 cursor-not-allowed opacity-50"
            disabled
            aria-disabled="true"
          >
            <ZohoIcon />
            Continue with Zoho
          </Button>
          <div
            role="tooltip"
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          >
            <AlertCircle className="inline size-3 mr-1" />
            Coming soon
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-2">
          By signing in, you agree to QVT Media&apos;s internal platform policies.
        </p>
      </CardContent>
    </Card>
  )
}
