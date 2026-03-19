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

  const url = new URL(req.url)
  const yearParam = url.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  const { revenueByMonth } = await getDashboardData(session.user.orgId, {
    dateRange: 'custom',
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  })

  const rows = revenueByMonth.map((r) => ({
    Month: r.label,
    Planned: r.planned,
    'Final Billable': r.finalBillable,
    Collected: r.collected,
    'Write-Off': r.writeOff,
    'Collection Rate (%)': r.finalBillable > 0 ? ((r.collected / r.finalBillable) * 100).toFixed(1) : '0.0',
  }))

  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Revenue ${year}`)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const bytes = new Uint8Array(buf as ArrayBuffer)

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="revenue-${year}.xlsx"`,
    },
  })
}
