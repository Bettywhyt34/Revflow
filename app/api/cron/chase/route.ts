/**
 * GET /api/cron/chase
 *
 * Vercel Cron endpoint — runs daily at 07:00 UTC, Mon–Fri.
 * Invokes the chase engine for every active organisation.
 *
 * Protected by CRON_SECRET env var.
 * Vercel sends: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runChaseEngine } from '@/lib/chase-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  // Allow unauthenticated calls only in local dev (no CRON_SECRET set)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // ── Fetch all organisations ───────────────────────────────────────────────
  const { data: orgs, error: orgErr } = await supabase
    .from('organisations')
    .select('id, name')

  if (orgErr) {
    console.error('cron/chase: failed to fetch organisations:', orgErr)
    return NextResponse.json({ error: 'Failed to fetch organisations.' }, { status: 500 })
  }

  // ── Run engine per org ────────────────────────────────────────────────────
  let totalSent = 0
  const failed: string[] = []

  for (const org of orgs ?? []) {
    try {
      const { sent } = await runChaseEngine(org.id)
      totalSent += sent
      if (sent > 0) {
        console.log(`cron/chase: org "${org.name}" (${org.id}) — ${sent} notifications sent`)
      }
    } catch (err) {
      console.error(`cron/chase: engine error for org "${org.name}" (${org.id}):`, err)
      failed.push(org.id)
    }
  }

  const result = {
    ok: true,
    orgs: (orgs ?? []).length,
    totalSent,
    ...(failed.length > 0 ? { failed } : {}),
  }

  console.log('cron/chase completed:', result)
  return NextResponse.json(result)
}
