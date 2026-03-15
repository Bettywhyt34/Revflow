'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import ClientForm from '@/components/clients/client-form'
import type { Client, OrgBankAccount } from '@/types'

export default function ClientDetailClient({
  client,
  canEdit,
  bankAccounts = [],
}: {
  client: Client
  canEdit: boolean
  bankAccounts?: OrgBankAccount[]
}) {
  const [editing, setEditing] = useState(false)
  const [localClient, setLocalClient] = useState(client)

  const assignedBank = bankAccounts.find(
    (a) => a.id === localClient.preferred_bank_account_id,
  )

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Edit Client</h2>
        <ClientForm
          client={localClient}
          bankAccounts={bankAccounts}
          onSuccess={(_, name) => {
            setLocalClient((prev) => ({ ...prev, client_name: name }))
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Client Details</h2>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500
              hover:text-gray-800 min-h-[32px] px-2 rounded-lg hover:bg-gray-100 transition"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      <dl className="space-y-3 text-sm">
        <Row label="Company" value={localClient.client_name} bold />
        <Row label="Contact" value={localClient.contact_person} />
        <Row label="Email" value={localClient.email} />
        <Row label="Phone" value={localClient.phone} />
        <Row label="Address" value={localClient.address} />
        <Row label="Payment Terms" value={localClient.payment_terms} />
        <Row
          label="Bank Account"
          value={
            assignedBank
              ? `${assignedBank.label || assignedBank.bank_name} · ${assignedBank.currency}`
              : undefined
          }
        />

        {localClient.cc_emails.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
              CC Emails
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {localClient.cc_emails.map((email) => (
                <span
                  key={email}
                  className="text-xs bg-teal-50 border border-teal-200 text-teal-800 px-2 py-0.5 rounded-md"
                >
                  {email}
                </span>
              ))}
            </dd>
          </div>
        )}

        {localClient.notes && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</dt>
            <dd className="text-gray-600 whitespace-pre-wrap">{localClient.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </dd>
    </div>
  )
}
