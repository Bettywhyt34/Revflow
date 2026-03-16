import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/data/notifications'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { id?: string; all?: boolean }

  if (body.all) {
    await markAllNotificationsRead(session.user.id, session.user.orgId)
  } else if (body.id) {
    await markNotificationRead(body.id)
  }

  return NextResponse.json({ ok: true })
}
