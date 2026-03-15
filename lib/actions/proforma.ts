'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { getNextDocumentNumber } from '@/lib/data/documents'
import { buildProformaEmailHtml } from '@/lib/email/proforma-email'
import type { SendDocumentParams } from '@/lib/actions/send-document'
import { Resend } from 'resend'

const VAT_RATE = 0.075

function calcFinancials(
  amountBeforeVat: number,
  includeAgencyFee: boolean,
  agencyFeePct: number,
) {
  const agencyFeeAmount = includeAgencyFee
    ? Math.round(amountBeforeVat * (agencyFeePct / 100) * 100) / 100
    : 0
  const vatBase = amountBeforeVat + agencyFeeAmount
  const vatAmount = Math.round(vatBase * VAT_RATE * 100) / 100
  const totalAmount = Math.round((vatBase + vatAmount) * 100) / 100
  return { agencyFeeAmount, vatAmount, totalAmount }
}

// ── Create (save as draft) ──────────────────────────────────────────────────

export interface CreateProformaInput {
  campaignId: string
  recipientName: string
  recipientEmail: string
  ccEmails: string[]
  recognitionStart: string   // YYYY-MM-DD
  recognitionEnd: string     // YYYY-MM-DD
  amountBeforeVat: number
  includeAgencyFee: boolean
  agencyFeePct: number
  issueDateOverride?: string // YYYY-MM-DD, defaults to today
  paymentTermsDays: number   // e.g. 30
  notes: string
}

export async function createProformaAction(
  input: CreateProformaInput,
): Promise<{ error?: string; docId?: string; docNumber?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  // Verify campaign belongs to org and is in plan_submitted status
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status, currency')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }
  if (campaign.status !== 'plan_submitted') {
    return { error: 'Campaign is not in plan_submitted status.' }
  }

  const docNumber = await getNextDocumentNumber(orgId, 'proforma_invoice')
  const issueDate = input.issueDateOverride ?? new Date().toISOString().split('T')[0]
  const dueDate = new Date(
    new Date(issueDate).getTime() + input.paymentTermsDays * 86400 * 1000,
  )
    .toISOString()
    .split('T')[0]
  const validUntil = dueDate

  const { agencyFeeAmount, vatAmount, totalAmount } = calcFinancials(
    input.amountBeforeVat,
    input.includeAgencyFee,
    input.agencyFeePct,
  )

  const { data: doc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      campaign_id: input.campaignId,
      type: 'proforma_invoice',
      status: 'draft',
      document_number: docNumber,
      version: 1,
      amount_before_vat: input.amountBeforeVat,
      agency_fee_amount: agencyFeeAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      currency: campaign.currency ?? 'NGN',
      exchange_rate: 1,
      issue_date: issueDate,
      due_date: dueDate,
      recognition_period_start: input.recognitionStart,
      recognition_period_end: input.recognitionEnd,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
      cc_emails: input.ccEmails ?? [],
      notes: input.notes || null,
      terms: `Payment due within ${input.paymentTermsDays} days of invoice date.`,
      created_by: session.user.id,
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('createProforma insert error:', insertErr)
    return { error: 'Failed to save proforma.' }
  }

  revalidatePath(`/campaigns/${input.campaignId}`)
  return { docId: doc.id, docNumber: docNumber }
}

// ── Send ────────────────────────────────────────────────────────────────────

export async function sendProformaAction(
  docId: string,
  campaignId: string,
  params: SendDocumentParams,
): Promise<{ error: string } | never> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'planner') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  // Fetch document + campaign in one query
  const { data: doc } = await supabase
    .from('documents')
    .select(
      `*, campaign:campaign_id(
        id, title, advertiser, tracker_id, campaign_type, agency_fee_pct,
        currency, org_id, status
      )`,
    )
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = doc.campaign as {
    id: string
    title: string
    advertiser: string
    tracker_id: string
    campaign_type: string
    agency_fee_pct: number
    currency: string
    org_id: string
    status: string
  }

  if (campaign.org_id !== orgId) return { error: 'Document not found.' }
  if (!params.sentTo) return { error: 'Recipient email is required.' }
  if (!doc.recognition_period_start || !doc.recognition_period_end) {
    return { error: 'Recognition period is required before sending.' }
  }

  const html = buildProformaEmailHtml({
    documentNumber: doc.document_number,
    issueDate: doc.issue_date,
    validUntil: doc.due_date ?? doc.issue_date,
    dueDate: doc.due_date ?? doc.issue_date,
    recipientName: params.recipientName || doc.recipient_name || campaign.advertiser,
    campaignTitle: campaign.title,
    trackerID: campaign.tracker_id,
    recognitionStart: doc.recognition_period_start,
    recognitionEnd: doc.recognition_period_end,
    amountBeforeVat: doc.amount_before_vat ?? 0,
    includeAgencyFee: (doc.agency_fee_amount ?? 0) > 0,
    agencyFeePct: campaign.agency_fee_pct ?? 10,
    agencyFeeAmount: doc.agency_fee_amount ?? 0,
    vatAmount: doc.vat_amount ?? 0,
    totalAmount: doc.total_amount ?? 0,
    currency: doc.currency ?? 'NGN',
    notes: doc.notes,
    messageBody: params.messageBody || null,
  })

  // Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)

  const extraAttachments = (params.attachments ?? []).map((a) => ({
    filename: a.name,
    path: a.url,
  }))

  const { error: emailErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'notifications@revflowapp.com',
    to: params.sentTo,
    ...(params.ccEmails.length > 0 ? { cc: params.ccEmails } : {}),
    ...(params.bccEmails.length > 0 ? { bcc: params.bccEmails } : {}),
    subject: params.subject || `Proforma Invoice ${doc.document_number} — ${campaign.title}`,
    html,
    ...(extraAttachments.length > 0 ? { attachments: extraAttachments } : {}),
  })

  if (emailErr) {
    console.error('Resend error:', emailErr)
    return { error: 'Failed to send email. Check RESEND_API_KEY.' }
  }

  // Mark document as sent, update recipient fields and metadata
  await supabase
    .from('documents')
    .update({
      status: 'current',
      sent_at: new Date().toISOString(),
      recipient_email: params.sentTo,
      recipient_name: params.recipientName,
      cc_emails: params.ccEmails,
      bcc_emails: params.bccEmails,
      subject: params.subject,
      sent_by: session.user.id,
    })
    .eq('id', docId)

  // Advance campaign status
  await supabase
    .from('campaigns')
    .update({ status: 'proforma_sent' })
    .eq('id', campaign.id)
    .eq('org_id', orgId)

  // Create notification
  await supabase.from('notifications').insert({
    org_id: orgId,
    campaign_id: campaign.id,
    type: 'approval_required',
    title: `Proforma ${doc.document_number} sent`,
    message: `Proforma sent to ${params.sentTo}. Awaiting PO from client.`,
  })

  revalidatePath(`/campaigns/${campaign.id}`)
  redirect(`/campaigns/${campaign.id}`)
}

// ── Preview ──────────────────────────────────────────────────────────────────

export async function getProformaPreviewAction(
  docId: string,
  recipientName: string,
  messageBody: string,
): Promise<{ html?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { orgId } = session.user
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select(
      `*, campaign:campaign_id(
        id, title, advertiser, tracker_id, campaign_type, agency_fee_pct,
        currency, org_id, status
      )`,
    )
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = doc.campaign as {
    id: string
    title: string
    advertiser: string
    tracker_id: string
    campaign_type: string
    agency_fee_pct: number
    currency: string
    org_id: string
    status: string
  }

  if (campaign.org_id !== orgId) return { error: 'Document not found.' }
  if (!doc.recognition_period_start || !doc.recognition_period_end) {
    return { error: 'Recognition period is required.' }
  }

  const html = buildProformaEmailHtml({
    documentNumber: doc.document_number,
    issueDate: doc.issue_date,
    validUntil: doc.due_date ?? doc.issue_date,
    dueDate: doc.due_date ?? doc.issue_date,
    recipientName: recipientName || doc.recipient_name || campaign.advertiser,
    campaignTitle: campaign.title,
    trackerID: campaign.tracker_id,
    recognitionStart: doc.recognition_period_start,
    recognitionEnd: doc.recognition_period_end,
    amountBeforeVat: doc.amount_before_vat ?? 0,
    includeAgencyFee: (doc.agency_fee_amount ?? 0) > 0,
    agencyFeePct: campaign.agency_fee_pct ?? 10,
    agencyFeeAmount: doc.agency_fee_amount ?? 0,
    vatAmount: doc.vat_amount ?? 0,
    totalAmount: doc.total_amount ?? 0,
    currency: doc.currency ?? 'NGN',
    notes: doc.notes,
    messageBody: messageBody || null,
  })

  return { html }
}
