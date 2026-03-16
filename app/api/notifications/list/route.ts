import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getNotifications } from '@/lib/data/notifications'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ notifications: [] })
  const notifications = await getNotifications(session.user.id, session.user.orgId, 40)
  return NextResponse.json({ notifications })
}
