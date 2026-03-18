import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = session.user
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('campaigns')
    .select('id, title, tracker_id')
    .eq('org_id', orgId)
    .not('status', 'in', '(cancelled,closed)')
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ campaigns: data ?? [] })
}
