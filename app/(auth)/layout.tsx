export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: brand panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D9488 0%, #065F59 60%, #042f2e 100%)' }}
      >
        {/* Subtle decorative circles */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />

        {/* Wordmark */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center font-bold text-base"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
          >
            R
          </div>
          <span className="text-2xl font-bold tracking-tight">Revflow</span>
        </div>

        {/* Centre copy */}
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold leading-snug tracking-tight">
            Campaign Billing.<br />Done Right.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-sm">
            AR &amp; Campaign Billing Platform for Media Agencies
          </p>
        </div>

        {/* Footer note */}
        <p className="text-white/40 text-xs relative z-10">
          © {new Date().getFullYear()} QVT Media. Internal platform.
        </p>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 min-h-screen">
        {/* Mobile wordmark (shown only when brand panel is hidden) */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: '#0D9488' }}
          >
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Revflow</span>
        </div>

        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
