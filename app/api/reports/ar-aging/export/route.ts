import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDashboardData } from '@/lib/data/dashboard'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role
  if (role !== 'admin' && role !== 'finance_exec') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { agingRows } = await getDashboardData(session.user.orgId, { dateRange: 'all_time' })

  const rows = agingRows.map((r) => ({
    Client: r.clientName,
    Campaign: r.campaignTitle,
    'Invoice #': r.documentNumber,
    Currency: r.currency,
    'Total Amount': r.totalAmount,
    Balance: r.balance,
    'Due Date': r.dueDate ?? '',
    'Days Overdue': r.daysOverdue,
    Bucket: r.bucket,
    'Finance Exec': r.financeExec,
  }))

  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'AR Aging')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const bytes = new Uint8Array(buf as ArrayBuffer)

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ar-aging-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
