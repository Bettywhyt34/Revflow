'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { createClientAction, updateClientAction } from '@/lib/actions/clients'
import type { Client, OrgBankAccount } from '@/types'

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 ' +
  'bg-white focus:outline-none focus:ring-2 focus:border-transparent transition ' +
  'disabled:bg-gray-50 disabled:text-gray-400'

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

// ── Email chip input ──────────────────────────────────────────────────────────
export function EmailChips({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const email = draft.trim().replace(/,$/, '').toLowerCase()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !value.includes(email)) {
      onChange([...value, email])
    }
    setDraft('')
  }

  return (
    <div
      className={`min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5
        flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:border-transparent transition
        ${disabled ? 'bg-gray-50' : 'cursor-text'}`}
      style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
      onClick={(e) => {
        if (!disabled) {
          ;(e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()
        }
      }}
    >
      {value.map((email) => (
        <span
          key={email}
          className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 text-xs px-2 py-1 rounded-md max-w-full"
        >
          <span className="truncate max-w-[180px]">{email}</span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((e2) => e2 !== email))
              }}
              className="flex-shrink-0 hover:text-red-500 transition ml-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={commit}
          placeholder={value.length === 0 ? (placeholder ?? 'Add email, press Enter…') : ''}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent py-0.5"
        />
      )}
    </div>
  )
}

// ── Client form ───────────────────────────────────────────────────────────────
export default function ClientForm({
  client,
  onSuccess,
  onCancel,
  compact = false,
  bankAccounts = [],
}: {
  client?: Client | null
  onSuccess?: (id: string, name: string) => void
  onCancel?: () => void
  compact?: boolean  // inline mini-form mode
  bankAccounts?: OrgBankAccount[]
}) {
  const isEditing = !!client
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clientName, setClientName] = useState(client?.client_name ?? '')
  const [contactPerson, setContactPerson] = useState(client?.contact_person ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [ccEmails, setCcEmails] = useState<string[]>(client?.cc_emails ?? [])
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [paymentTerms, setPaymentTerms] = useState(client?.payment_terms ?? 'Net 30')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [preferredBankAccountId, setPreferredBankAccountId] = useState(
    client?.preferred_bank_account_id ?? '',
  )

  function handleSubmit() {
    setError(null)
    if (!clientName.trim()) { setError('Client name is required.'); return }

    startTransition(async () => {
      const input = {
        clientName,
        contactPerson,
        email,
        ccEmails,
        phone,
        address,
        paymentTerms,
        notes,
        preferredBankAccountId: preferredBankAccountId || null,
      }

      if (isEditing) {
        const result = await updateClientAction(client!.id, input)
        if (result.error) { setError(result.error); return }
        onSuccess?.(client!.id, clientName)
      } else {
        const result = await createClientAction(input)
        if (result.error) { setError(result.error); return }
        onSuccess?.(result.clientId!, result.clientName!)
      }
    })
  }

  return (
    <div className={`space-y-${compact ? '3' : '5'}`}>
      {/* Client Name */}
      <div>
        <Label required>Client / Company Name</Label>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Dangote Cement PLC"
          className={inputCls}
          style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
        />
      </div>

      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Contact Person</Label>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Amaka Obi"
              className={inputCls}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 801 000 0000"
              className={inputCls}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>
        </div>
      )}

      <div>
        <Label>Primary Email</Label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="billing@client.com"
          className={inputCls}
          style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
        />
      </div>

      <div>
        <Label>CC Emails</Label>
        <EmailChips value={ccEmails} onChange={setCcEmails} />
        <p className="text-xs text-gray-400 mt-1">
          These will be pre-filled on all proformas and invoices.
        </p>
      </div>

      {!compact && (
        <>
          <div>
            <Label>Address</Label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, city…"
              className={`${inputCls} resize-none`}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Payment Terms</Label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className={inputCls}
                style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
              >
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
                <option>Due on receipt</option>
              </select>
            </div>
            <div>
              <Label>Default Currency</Label>
              <select
                value={paymentTerms === 'Net 30' ? 'NGN' : 'NGN'}
                onChange={() => {}}
                className={`${inputCls} text-gray-400`}
                disabled
              >
                <option value="NGN">NGN — Nigerian Naira</option>
              </select>
            </div>
          </div>

          {bankAccounts.length > 0 && (
            <div>
              <Label>Assigned Bank Account</Label>
              <select
                value={preferredBankAccountId}
                onChange={(e) => setPreferredBankAccountId(e.target.value)}
                className={inputCls}
                style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
              >
                <option value="">— None (use org default) —</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.bank_name} · {a.currency}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Proforma and invoice emails will use this account&apos;s payment details.
              </p>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this client…"
              className={`${inputCls} resize-none`}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          {error}
        </p>
      )}

      <div className={`flex gap-3 ${compact ? 'flex-row' : 'flex-col sm:flex-row'}`}>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className={`${compact ? '' : 'flex-1'} inline-flex items-center justify-center
            min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition
            disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{ background: '#0D9488' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#0b857a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#0D9488')}
        >
          {isPending
            ? isEditing ? 'Saving…' : 'Creating…'
            : isEditing ? 'Save Changes' : compact ? 'Save Client' : 'Create Client'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isPending}
            className={`${compact ? '' : 'flex-1'} inline-flex items-center justify-center
              min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300
              text-gray-700 hover:bg-gray-50 transition disabled:opacity-50`}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
