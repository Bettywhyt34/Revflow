import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCampaigns } from '@/lib/data/campaigns'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role
  if (role !== 'admin' && role !== 'finance_exec') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const clientParam = url.searchParams.get('client')
  const execParam = url.searchParams.get('exec')

  const campaigns = await getCampaigns(session.user.orgId)

  const filtered = campaigns.filter((c) => {
    if (statusParam && c.status !== statusParam) return false
    if (clientParam && c.client_id !== clientParam) return false
    if (execParam && c.account_manager_id !== execParam) return false
    return true
  })

  const rows = filtered.map((c) => ({
    'Tracker ID': c.tracker_id,
    Client: c.client?.client_name ?? '',
    Advertiser: c.advertiser,
    Status: c.status,
    'Finance Exec': c.account_manager?.full_name ?? '',
    Planned: c.planned_contract_value ?? 0,
    'Final Billable': c.final_billable ?? '',
    'Write-Off': c.adjustment_write_off ?? 0,
    'Start Date': c.start_date ?? '',
    'End Date': c.end_date ?? '',
    'Created At': c.created_at?.slice(0, 10) ?? '',
  }))

  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Campaigns')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const bytes = new Uint8Array(buf as ArrayBuffer)

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="campaigns-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
