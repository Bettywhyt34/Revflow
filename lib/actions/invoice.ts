'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { getNextDocumentNumber } from '@/lib/data/documents'
import { buildProformaEmailHtml } from '@/lib/email/proforma-email'
import { getDefaultBankAccount } from '@/lib/data/settings'
import { recalculateCampaignMetrics } from '@/lib/calculations'
import type { SendDocumentParams } from '@/lib/actions/send-document'
import type { OrgBankAccount } from '@/types'
import { Resend } from 'resend'

const VAT_RATE = 0.075

// Allowed source statuses for creating a direct invoice
const ALLOWED_STATUSES = ['plan_submitted', 'proforma_sent', 'po_received']

async function resolveBankAccount(
  bankAccountId: string | null | undefined,
  clientId: string | null | undefined,
  orgId: string,
): Promise<OrgBankAccount | null> {
  const supabase = createAdminClient()
  if (bankAccountId) {
    const { data } = await supabase
      .from('org_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (data) return data as OrgBankAccount
  }
  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('preferred_bank_account_id')
      .eq('id', clientId)
      .maybeSingle()
    const prefId = (client as { preferred_bank_account_id?: string | null } | null)
      ?.preferred_bank_account_id
    if (prefId) {
      const { data } = await supabase
        .from('org_bank_accounts')
        .select('*')
        .eq('id', prefId)
        .eq('org_id', orgId)
        .maybeSingle()
      if (data) return data as OrgBankAccount
    }
  }
  return getDefaultBankAccount(orgId)
}

export interface InvoiceLineItem {
  qty: number
  description: string
  unit_price: number
  line_total: number
}

export interface CreateInvoiceInput {
  campaignId: string
  recipientName: string
  recipientEmail: string
  ccEmails: string[]
  recognitionStart: string
  recognitionEnd: string
  lineItems: InvoiceLineItem[]
  invoiceSubject: string
  issueDateOverride?: string
  paymentTermsDays: number
  notes: string
  mpoFilePath?: string | null   // path in Supabase Storage if uploaded
  templateId?: string           // '1' | '2' | '3', defaults to '1'
  mismatchAcknowledged?: boolean
  mismatchOverrideReason?: string
}

export interface MismatchInfo {
  proforma: { amount_before_vat: number; vat_amount: number; total_amount: number }
  invoice: { amount_before_vat: number; vat_amount: number; total_amount: number }
  fields: string[]
}

export async function createInvoiceAction(
  input: CreateInvoiceInput,
): Promise<{ error?: string; docId?: string; docNumber?: string; mismatch?: MismatchInfo }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status, currency')
    .eq('id', input.campaignId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!campaign) return { error: 'Campaign not found.' }
  if (!ALLOWED_STATUSES.includes(campaign.status)) {
    return { error: 'Campaign is not in an eligible status to create an invoice.' }
  }

  const subtotal = input.lineItems.reduce((s, i) => s + i.line_total, 0)
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100

  // ── Mismatch detection ──────────────────────────────────────────────────────
  if (!input.mismatchAcknowledged) {
    const { data: latestProforma } = await supabase
      .from('documents')
      .select('amount_before_vat, vat_amount, total_amount')
      .eq('campaign_id', input.campaignId)
      .eq('type', 'proforma_invoice')
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestProforma) {
      const THRESHOLD = 0.01
      const diffs: string[] = []
      if (Math.abs((latestProforma.amount_before_vat ?? 0) - subtotal) > THRESHOLD) {
        diffs.push('Amount Before VAT')
      }
      if (Math.abs((latestProforma.vat_amount ?? 0) - vatAmount) > THRESHOLD) {
        diffs.push('VAT Amount')
      }
      if (Math.abs((latestProforma.total_amount ?? 0) - totalAmount) > THRESHOLD) {
        diffs.push('Total Amount')
      }
      if (diffs.length > 0) {
        return {
          mismatch: {
            proforma: {
              amount_before_vat: latestProforma.amount_before_vat ?? 0,
              vat_amount: latestProforma.vat_amount ?? 0,
              total_amount: latestProforma.total_amount ?? 0,
            },
            invoice: { amount_before_vat: subtotal, vat_amount: vatAmount, total_amount: totalAmount },
            fields: diffs,
          },
        }
      }
    }
  }

  // If mismatch acknowledged, log it
  if (input.mismatchAcknowledged && input.mismatchOverrideReason) {
    const { data: latestProforma } = await supabase
      .from('documents')
      .select('id, amount_before_vat, vat_amount, total_amount, document_number')
      .eq('campaign_id', input.campaignId)
      .eq('type', 'proforma_invoice')
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestProforma) {
      const fields: Array<{ field: string; proformaValue: number; invoiceValue: number }> = []
      if (Math.abs((latestProforma.amount_before_vat ?? 0) - subtotal) > 0.01) {
        fields.push({ field: 'amount_before_vat', proformaValue: latestProforma.amount_before_vat ?? 0, invoiceValue: subtotal })
      }
      if (Math.abs((latestProforma.total_amount ?? 0) - totalAmount) > 0.01) {
        fields.push({ field: 'total_amount', proformaValue: latestProforma.total_amount ?? 0, invoiceValue: totalAmount })
      }

      if (fields.length > 0) {
        await supabase.from('value_mismatch_log').insert(
          fields.map((f) => ({
            org_id: orgId,
            campaign_id: input.campaignId,
            proforma_document_id: latestProforma.id,
            field_name: f.field,
            proforma_value: f.proformaValue,
            invoice_value: f.invoiceValue,
            override_reason: input.mismatchOverrideReason,
            overridden_by: session.user.id,
          })),
        )

        // Notify admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('org_id', orgId)
          .eq('role', 'admin')

        const { data: campaignData } = await supabase
          .from('campaigns')
          .select('tracker_id')
          .eq('id', input.campaignId)
          .maybeSingle()

        if (admins && admins.length > 0) {
          await supabase.from('notifications').insert(
            admins.map((u) => ({
              org_id: orgId,
              campaign_id: input.campaignId,
              user_id: u.id,
              type: 'system',
              title: `Mismatch override — ${campaignData?.tracker_id ?? input.campaignId}`,
              message: `Invoice/Proforma value mismatch overridden. Reason: ${input.mismatchOverrideReason}`,
            })),
          )
        }
      }
    }
  }

  const docNumber = await getNextDocumentNumber(orgId, 'invoice')
  const issueDate = input.issueDateOverride ?? new Date().toISOString().split('T')[0]
  const dueDate = new Date(
    new Date(issueDate).getTime() + input.paymentTermsDays * 86400 * 1000,
  )
    .toISOString()
    .split('T')[0]

  const { data: doc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      campaign_id: input.campaignId,
      type: 'invoice',
      status: 'draft',
      document_number: docNumber,
      version: 1,
      amount_before_vat: subtotal,
      agency_fee_amount: 0,
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
      terms: input.paymentTermsDays === 0
        ? 'Payment due on receipt.'
        : `Payment due within ${input.paymentTermsDays} days of invoice date.`,
      line_items: input.lineItems,
      invoice_subject: input.invoiceSubject || null,
      file_path: input.mpoFilePath ?? null,
      template_id: input.templateId ?? '1',
      created_by: session.user.id,
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('createInvoice insert error:', insertErr)
    return { error: 'Failed to save invoice.' }
  }

  revalidatePath(`/campaigns/${input.campaignId}`)
  return { docId: doc.id, docNumber }
}

// ── Update Draft ─────────────────────────────────────────────────────────────

export async function updateInvoiceDraftAction(
  docId: string,
  input: CreateInvoiceInput,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, campaign_id, campaigns!inner(org_id)')
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }
  const docCampaign = (doc.campaigns as unknown) as { org_id: string } | null
  if (!docCampaign || docCampaign.org_id !== orgId) return { error: 'Document not found.' }
  if (doc.status !== 'draft') return { error: 'Only DRAFT documents can be edited.' }

  const subtotal = input.lineItems.reduce((s, i) => s + i.line_total, 0)
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100

  const issueDate = input.issueDateOverride ?? new Date().toISOString().split('T')[0]
  const dueDate = new Date(
    new Date(issueDate).getTime() + input.paymentTermsDays * 86400 * 1000,
  ).toISOString().split('T')[0]

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      amount_before_vat: subtotal,
      agency_fee_amount: 0,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      issue_date: issueDate,
      due_date: dueDate,
      recognition_period_start: input.recognitionStart,
      recognition_period_end: input.recognitionEnd,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
      cc_emails: input.ccEmails ?? [],
      notes: input.notes || null,
      terms: input.paymentTermsDays === 0
        ? 'Payment due on receipt.'
        : `Payment due within ${input.paymentTermsDays} days of invoice date.`,
      line_items: input.lineItems,
      invoice_subject: input.invoiceSubject || null,
      file_path: input.mpoFilePath ?? null,
      template_id: input.templateId ?? '1',
    })
    .eq('id', docId)

  if (updateErr) return { error: 'Failed to update document.' }

  revalidatePath(`/campaigns/${doc.campaign_id}`)
  return {}
}

// ── Send ────────────────────────────────────────────────────────────────────

export async function sendInvoiceAction(
  docId: string,
  campaignId: string,
  params: SendDocumentParams,
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const { role, orgId } = session.user
  if (role !== 'admin' && role !== 'finance_exec') return { error: 'Insufficient permissions.' }

  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select(
      `*, campaign:campaign_id(
        id, title, advertiser, tracker_id, campaign_type, agency_fee_pct,
        currency, org_id, status, client_id
      )`,
    )
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = doc.campaign as {
    id: string; title: string; advertiser: string; tracker_id: string;
    campaign_type: string; agency_fee_pct: number; currency: string;
    org_id: string; status: string; client_id: string | null
  }

  if (campaign.org_id !== orgId) return { error: 'Document not found.' }
  if (!params.sentTo) return { error: 'Recipient email is required.' }

  const bankAccount = await resolveBankAccount(params.bankAccountId, campaign.client_id, orgId)

  const html = buildProformaEmailHtml({
    documentNumber: doc.document_number,
    issueDate: doc.issue_date,
    validUntil: doc.due_date ?? doc.issue_date,
    dueDate: doc.due_date ?? doc.issue_date,
    recipientName: params.recipientName || doc.recipient_name || campaign.advertiser,
    campaignTitle: campaign.title,
    trackerID: campaign.tracker_id,
    recognitionStart: doc.recognition_period_start ?? '',
    recognitionEnd: doc.recognition_period_end ?? '',
    amountBeforeVat: doc.amount_before_vat ?? 0,
    includeAgencyFee: false,
    agencyFeePct: 0,
    agencyFeeAmount: 0,
    vatAmount: doc.vat_amount ?? 0,
    totalAmount: doc.total_amount ?? 0,
    currency: doc.currency ?? 'NGN',
    notes: doc.notes,
    messageBody: params.messageBody || null,
    bankName: bankAccount?.bank_name ?? null,
    accountName: bankAccount?.account_name ?? null,
    accountNumber: bankAccount?.account_number ?? null,
    bankCode: bankAccount?.bank_code ?? null,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)

  const attachments = (params.attachments ?? []).map((a) => ({ filename: a.name, path: a.url }))

  // Include MPO attachment if stored
  if (doc.file_path) {
    const supabaseAdmin = createAdminClient()
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('campaign-documents')
      .createSignedUrl(doc.file_path, 3600)
    if (signedUrl?.signedUrl) {
      attachments.push({ filename: 'MPO.pdf', path: signedUrl.signedUrl })
    }
  }

  const { error: emailErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'notifications@revflowapp.com',
    to: params.sentTo,
    ...(params.ccEmails.length > 0 ? { cc: params.ccEmails } : {}),
    ...(params.bccEmails.length > 0 ? { bcc: params.bccEmails } : {}),
    subject: params.subject || `Invoice ${doc.document_number} — ${campaign.title}`,
    html,
    ...(attachments.length > 0 ? { attachments } : {}),
  })

  if (emailErr) {
    console.error('Resend error:', emailErr)
    return { error: 'Failed to send email. Check RESEND_API_KEY.' }
  }

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

  await supabase
    .from('campaigns')
    .update({ status: 'invoice_sent' })
    .eq('id', campaign.id)
    .eq('org_id', orgId)

  await supabase.from('notifications').insert({
    org_id: orgId,
    campaign_id: campaign.id,
    type: 'invoice_due',
    title: `Invoice ${doc.document_number} sent`,
    message: `Invoice sent to ${params.sentTo}. Awaiting payment.`,
  })

  // Recalculate planned_contract_value based on priority rules
  await recalculateCampaignMetrics(campaign.id)

  revalidatePath(`/campaigns/${campaign.id}`)
  return {}
}

// ── Preview ──────────────────────────────────────────────────────────────────

export async function getInvoicePreviewAction(
  docId: string,
  recipientName: string,
  messageBody: string,
  bankAccountId?: string,
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
        currency, org_id, status, client_id
      )`,
    )
    .eq('id', docId)
    .maybeSingle()

  if (!doc) return { error: 'Document not found.' }

  const campaign = doc.campaign as {
    id: string; title: string; advertiser: string; tracker_id: string;
    campaign_type: string; agency_fee_pct: number; currency: string;
    org_id: string; status: string; client_id: string | null
  }

  if (campaign.org_id !== orgId) return { error: 'Document not found.' }

  const bankAccount = await resolveBankAccount(bankAccountId, campaign.client_id, orgId)

  const html = buildProformaEmailHtml({
    documentNumber: doc.document_number,
    issueDate: doc.issue_date,
    validUntil: doc.due_date ?? doc.issue_date,
    dueDate: doc.due_date ?? doc.issue_date,
    recipientName: recipientName || doc.recipient_name || campaign.advertiser,
    campaignTitle: campaign.title,
    trackerID: campaign.tracker_id,
    recognitionStart: doc.recognition_period_start ?? '',
    recognitionEnd: doc.recognition_period_end ?? '',
    amountBeforeVat: doc.amount_before_vat ?? 0,
    includeAgencyFee: false,
    agencyFeePct: 0,
    agencyFeeAmount: 0,
    vatAmount: doc.vat_amount ?? 0,
    totalAmount: doc.total_amount ?? 0,
    currency: doc.currency ?? 'NGN',
    notes: doc.notes,
    messageBody: messageBody || null,
    bankName: bankAccount?.bank_name ?? null,
    accountName: bankAccount?.account_name ?? null,
    accountNumber: bankAccount?.account_number ?? null,
    bankCode: bankAccount?.bank_code ?? null,
  })

  return { html }
}
