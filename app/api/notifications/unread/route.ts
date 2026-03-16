import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getUnreadCount } from '@/lib/data/notifications'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ count: 0 })
  const count = await getUnreadCount(session.user.id, session.user.orgId)
  return NextResponse.json({ count })
}
