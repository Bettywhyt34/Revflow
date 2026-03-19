import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization') ?? ''
  const apiKey = process.env.FINOS_SYNC_API_KEY
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse ?since= param; default to 30 days ago
  const url = new URL(req.url)
  const sinceParam = url.searchParams.get('since')
  let sinceDate: Date
  if (sinceParam) {
    sinceDate = new Date(sinceParam)
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 })
    }
  } else {
    sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - 30)
  }

  const sinceISO = sinceDate.toISOString()
  const supabase = createAdminClient()

  const [
    { data: journalEntries },
    { data: campaigns },
    { data: documents },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('*')
      .gt('created_at', sinceISO)
      .order('created_at', { ascending: true }),

    supabase
      .from('campaigns')
      .select(
        'id, org_id, tracker_id, title, advertiser, status, planned_contract_value, final_billable, adjustment_write_off, compliance_pct, compliance_amount_before_vat, client_id, account_manager_id, start_date, end_date, created_at, updated_at',
      )
      .gt('updated_at', sinceISO)
      .order('updated_at', { ascending: true }),

    supabase
      .from('documents')
      .select('id, campaign_id, org_id, type, status, document_number, total_amount, currency, due_date, sent_at, created_at')
      .gt('created_at', sinceISO)
      .in('type', ['invoice', 'proforma_invoice'])
      .order('created_at', { ascending: true }),

    supabase
      .from('payments')
      .select('id, campaign_id, org_id, amount, actual_cash_received, wht_amount, wht_type, payment_date, reference, currency, created_at')
      .gt('created_at', sinceISO)
      .order('created_at', { ascending: true }),
  ])

  const syncedAt = new Date().toISOString()

  return NextResponse.json({
    synced_at: syncedAt,
    since: sinceISO,
    source_app: 'revflow',
    counts: {
      journal_entries: journalEntries?.length ?? 0,
      campaigns: campaigns?.length ?? 0,
      documents: documents?.length ?? 0,
      payments: payments?.length ?? 0,
    },
    journal_entries: journalEntries ?? [],
    campaigns: campaigns ?? [],
    documents: documents ?? [],
    payments: payments ?? [],
  })
}
