'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { notifyRole } from '@/lib/notify'
import { recalculateCampaignMetrics } from '@/lib/calculations'

export interface LogPaymentInput {
  campaignId: string
  documentId: string | null
  paymentDate: string
  paymentMethod: 'bank_transfer' | 'cheque' | 'cash' | 'other'
  reference?: string
  notes?: string
  whtApplicable: boolean
  whtType?: string
  whtRate?: number
  whtAmount: number
  whtCertificateNumber?: string
  whtCreditNoteNumber?: string
  actualCashReceived: number
  confirmOverpayment?: boolean
}

export interface LogPaymentResult {
  error?: string
  overpayment?: boolean
  excess?: number
  paymentId?: string
}

export async function logPaymentAction(input: LogPaymentInput): Promise<LogPaymentResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId, id: userId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return { error: 'Only admin or finance_exec can log payments.' }
  }

  const supabase = createAdminClient()

  // Fetch campaign (org-scoped)
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, org_id, tracker_id, title, planned_contract_value, currency, status, client_id')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (campErr || !campaign) return { error: 'Campaign not found.' }

  const allowedStatuses = ['invoice_sent', 'partially_paid', 'fully_paid']
  if (!allowedStatuses.includes(campaign.status)) {
    return { error: 'Campaign is not in a payable status.' }
  }

  const totalSettled = input.actualCashReceived + input.whtAmount
  const finalBillable = campaign.planned_contract_value ?? 0

  // Fetch existing total paid
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('total_settled, amount')
    .eq('campaign_id', input.campaignId)

  const existingTotal = (existingPayments ?? []).reduce(
    (sum, p) => sum + (p.total_settled ?? p.amount ?? 0),
    0,
  )

  // Overpayment check
  if (!input.confirmOverpayment && finalBillable > 0) {
    const excess = totalSettled - (finalBillable - existingTotal)
    if (excess > 0.01) {
      return { overpayment: true, excess }
    }
  }

  // Fetch invoice doc total for journal entry credit
  let invoiceTotalAmount = input.actualCashReceived + input.whtAmount
  if (input.documentId) {
    const { data: doc } = await supabase
      .from('documents')
      .select('total_amount')
      .eq('id', input.documentId)
      .maybeSingle()
    if (doc?.total_amount) invoiceTotalAmount = doc.total_amount
  }

  // Insert payment
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      campaign_id: input.campaignId,
      document_id: input.documentId ?? null,
      amount: input.actualCashReceived,
      currency: campaign.currency ?? 'NGN',
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      wht_applicable: input.whtApplicable,
      wht_amount: input.whtAmount,
      wht_rate: input.whtRate ?? null,
      wht_certificate_number: input.whtCertificateNumber?.trim() || null,
      wht_credit_note_number: input.whtCreditNoteNumber?.trim() || null,
      actual_cash_received: input.actualCashReceived,
      total_settled: totalSettled,
      logged_by: userId,
    })
    .select('id')
    .single()

  if (payErr || !payment) {
    console.error('logPayment insert error:', payErr)
    return { error: 'Failed to record payment.' }
  }

  // Insert WHT credit record
  if (input.whtAmount > 0) {
    const taxYear = new Date(input.paymentDate).getFullYear()
    await supabase.from('wht_credits').insert({
      org_id: orgId,
      campaign_id: input.campaignId,
      payment_id: payment.id,
      client_id: campaign.client_id,
      wht_amount: input.whtAmount,
      wht_rate: input.whtRate ?? null,
      wht_type: input.whtType ?? null,
      certificate_number: input.whtCertificateNumber?.trim() || null,
      credit_note_number: input.whtCreditNoteNumber?.trim() || null,
      tax_year: taxYear,
      status: 'available',
    })
  }

  // Post journal entries
  if (input.whtAmount > 0) {
    // Dr 1000 Cash actual_cash_received
    // Dr 1150 WHT Receivable wht_amount
    // Cr 1100 AR invoice total (full gross)
    await supabase.from('journal_entries').insert([
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: input.documentId ?? null,
        payment_id: payment.id,
        transaction_date: input.paymentDate,
        account_code: '1000',
        description: `Cash received — ${campaign.tracker_id}`,
        debit: input.actualCashReceived,
        credit: 0,
        source_app: 'revflow',
        created_by: userId,
      },
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: input.documentId ?? null,
        payment_id: payment.id,
        transaction_date: input.paymentDate,
        account_code: '1150',
        description: `WHT Receivable — ${campaign.tracker_id}`,
        debit: input.whtAmount,
        credit: 0,
        source_app: 'revflow',
        created_by: userId,
      },
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: input.documentId ?? null,
        payment_id: payment.id,
        transaction_date: input.paymentDate,
        account_code: '1100',
        description: `AR cleared — ${campaign.tracker_id}`,
        debit: 0,
        credit: invoiceTotalAmount,
        source_app: 'revflow',
        created_by: userId,
      },
    ])
  } else {
    // Dr 1000 Cash, Cr 1100 AR
    await supabase.from('journal_entries').insert([
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: input.documentId ?? null,
        payment_id: payment.id,
        transaction_date: input.paymentDate,
        account_code: '1000',
        description: `Cash received — ${campaign.tracker_id}`,
        debit: input.actualCashReceived,
        credit: 0,
        source_app: 'revflow',
        created_by: userId,
      },
      {
        org_id: orgId,
        campaign_id: input.campaignId,
        document_id: input.documentId ?? null,
        payment_id: payment.id,
        transaction_date: input.paymentDate,
        account_code: '1100',
        description: `AR cleared — ${campaign.tracker_id}`,
        debit: 0,
        credit: input.actualCashReceived,
        source_app: 'revflow',
        created_by: userId,
      },
    ])
  }

  // Recompute campaign status
  const newTotalPaid = existingTotal + totalSettled
  let newStatus: string
  if (finalBillable > 0 && newTotalPaid >= finalBillable - 0.01) {
    newStatus = 'fully_paid'
  } else {
    newStatus = 'partially_paid'
  }

  await supabase
    .from('campaigns')
    .update({ status: newStatus })
    .eq('id', input.campaignId)

  // Fetch client name for notification
  let clientName = 'Client'
  if (campaign.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('client_name')
      .eq('id', campaign.client_id)
      .maybeSingle()
    if (client?.client_name) clientName = client.client_name
  }

  const balance = Math.max(0, finalBillable - newTotalPaid)
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: campaign.currency ?? 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  let notifTitle: string
  let notifMessage: string
  if (newStatus === 'fully_paid') {
    notifTitle = `Campaign fully paid — ${campaign.tracker_id}`
    notifMessage = `${clientName} — ${campaign.title}. Total settled: ${fmt(newTotalPaid)}`
  } else {
    notifTitle = `Payment received — ${campaign.tracker_id}`
    notifMessage = `${fmt(input.actualCashReceived)} cash${input.whtAmount > 0 ? ` + ${fmt(input.whtAmount)} WHT` : ''} from ${clientName}. Balance: ${fmt(balance)}`
  }

  const actionPath = `/campaigns/${input.campaignId}`
  // Notify admin + finance_exec with email
  await notifyRole(orgId, 'admin', {
    campaignId: input.campaignId,
    type: 'payment_received',
    title: notifTitle,
    message: notifMessage,
    actionPath,
  })
  await notifyRole(orgId, 'finance_exec', {
    campaignId: input.campaignId,
    type: 'payment_received',
    title: notifTitle,
    message: notifMessage,
    actionPath,
  })

  // Recalculate planned_contract_value in case it wasn't set before this payment
  await recalculateCampaignMetrics(input.campaignId)

  revalidatePath(`/campaigns/${input.campaignId}`)
  revalidatePath('/campaigns')
  revalidatePath('/reports/wht-credits')

  return { paymentId: payment.id }
}

export async function updatePaymentWhtAction(
  paymentId: string,
  campaignId: string,
  whtCertNumber: string,
  whtCreditNoteNumber: string,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') {
    return { error: 'Insufficient permissions.' }
  }

  const supabase = createAdminClient()

  // Verify campaign belongs to org
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }

  const { error: payErr } = await supabase
    .from('payments')
    .update({
      wht_certificate_number: whtCertNumber.trim() || null,
      wht_credit_note_number: whtCreditNoteNumber.trim() || null,
    })
    .eq('id', paymentId)
    .eq('campaign_id', campaignId)

  if (payErr) return { error: 'Failed to update payment.' }

  // Also update wht_credits
  await supabase
    .from('wht_credits')
    .update({
      certificate_number: whtCertNumber.trim() || null,
      credit_note_number: whtCreditNoteNumber.trim() || null,
    })
    .eq('payment_id', paymentId)

  revalidatePath(`/campaigns/${campaignId}`)
  return {}
}
