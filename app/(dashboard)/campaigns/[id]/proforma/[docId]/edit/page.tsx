import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { getDocumentById } from '@/lib/data/documents'
import { getCampaignById } from '@/lib/data/campaigns'
import { getOrgSettingsWithDefaults } from '@/lib/data/settings'
import { createAdminClient } from '@/lib/supabase'
import type { UserRole } from '@/types'
import ProformaForm from '../../new/proforma-form'
import type { InitialProformaDoc } from '../../new/proforma-form'
import type { SavedLineItem } from '@/lib/data/documents'

export async function generateMetadata() {
  return { title: 'Edit Proforma — Revflow' }
}

function parsePaymentTermsDays(terms: string | null | undefined): number {
  if (!terms) return 30
  if (terms === 'Due on receipt' || terms === 'Due on Receipt') return 0
  const m = terms.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 30
}

export default async function EditProformaPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { id, docId } = await params
  const session = await auth()
  const role = session!.user.role as UserRole
  const orgId = session!.user.orgId

  if (role !== 'admin' && role !== 'planner' && role !== 'finance_exec') {
    redirect(`/campaigns/${id}`)
  }

  const [doc, campaign, orgSettings] = await Promise.all([
    getDocumentById(docId, orgId),
    getCampaignById(id, orgId),
    getOrgSettingsWithDefaults(orgId),
  ])

  if (!doc) notFound()
  if (!campaign) notFound()
  if (doc.campaign.id !== id) notFound()
  if (doc.type !== 'proforma_invoice') notFound()
  if (doc.status !== 'draft') redirect(`/campaigns/${id}/proforma/${docId}`)

  const client = campaign.client ?? null

  // Fetch client extras
  const clientRow = client
    ? await createAdminClient()
        .from('clients')
        .select('preferred_bank_account_id, customer_id, address')
        .eq('id', campaign.client_id!)
        .maybeSingle()
    : { data: null }

  const rawClient = clientRow.data as {
    preferred_bank_account_id?: string | null
    customer_id?: string | null
    address?: string | null
  } | null

  const initialDoc: InitialProformaDoc = {
    id: doc.id,
    document_number: doc.document_number,
    version: doc.version ?? 1,
    recipient_name: doc.recipient_name ?? null,
    recipient_email: doc.recipient_email ?? null,
    cc_emails: Array.isArray(doc.cc_emails) ? (doc.cc_emails as string[]) : [],
    recognition_period_start: doc.recognition_period_start ?? null,
    recognition_period_end: doc.recognition_period_end ?? null,
    invoice_subject: doc.invoice_subject ?? null,
    line_items: ((doc.line_items ?? []) as SavedLineItem[]).map((i) => ({
      qty: i.qty,
      description: i.description,
      unit_price: i.unit_price,
      line_total: i.line_total,
    })),
    issue_date: doc.issue_date ?? null,
    due_date: doc.due_date ?? null,
    notes: doc.notes ?? null,
    template_id: doc.template_id ?? '1',
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <ProformaForm
        campaignId={id}
        campaign={{
          title: campaign.title,
          advertiser: campaign.advertiser,
          agency_name: campaign.agency_name,
          campaign_type: campaign.campaign_type,
          agency_fee_pct: campaign.agency_fee_pct,
          currency: campaign.currency,
          tracker_id: campaign.tracker_id,
          planned_contract_value: campaign.planned_contract_value,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
        }}
        clientEmail={client?.email ?? null}
        clientCcEmails={client?.cc_emails ?? []}
        clientName={client?.client_name ?? null}
        clientAddress={rawClient?.address ?? null}
        clientCustomerId={rawClient?.customer_id ?? null}
        clientPaymentTermsDays={parsePaymentTermsDays(client?.payment_terms)}
        defaultTemplateId={orgSettings.default_proforma_template ?? '1'}
        initialDoc={initialDoc}
        editDocId={docId}
      />
    </div>
  )
}
