'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Plus, X, ChevronDown, CheckCircle2 } from 'lucide-react'
import { createCampaignWithClientAction } from '@/lib/actions/campaigns'
import { createClientAction } from '@/lib/actions/clients'

type ClientOption = { id: string; client_name: string; email: string | null; cc_emails: string[] }

const inputCls =
  'w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm ' +
  'text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#0D9488] ' +
  'focus:ring-2 focus:ring-[#0D9488]/20 disabled:bg-gray-50'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5'

// ── Client selector combobox ──────────────────────────────────────────────────
function ClientSelector({
  clients,
  selectedId,
  onSelect,
  onInlineCreate,
}: {
  clients: ClientOption[]
  selectedId: string | null
  onSelect: (client: ClientOption | null) => void
  onInlineCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = clients.find((c) => c.id === selectedId) ?? null

  const filtered = clients.filter((c) =>
    c.client_name.toLowerCase().includes(query.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(client: ClientOption) {
    onSelect(client)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect(null)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm flex items-center gap-2 cursor-pointer transition
          ${open ? 'border-[#0D9488] ring-2 ring-[#0D9488]/20' : 'border-gray-200 hover:border-gray-300'}`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        {selected ? (
          <>
            <span className="flex-1 font-medium text-gray-900 truncate">{selected.client_name}</span>
            {selected.email && (
              <span className="text-xs text-gray-400 truncate max-w-[140px] hidden sm:block">
                {selected.email}
              </span>
            )}
            <button onClick={handleClear} className="ml-auto text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-gray-400">Select a client…</span>
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-8 pr-3 py-1.5 text-sm outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 transition flex items-center gap-2
                    ${client.id === selectedId ? 'bg-teal-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{client.client_name}</p>
                    {client.email && (
                      <p className="text-xs text-gray-400 truncate">{client.email}</p>
                    )}
                  </div>
                  {client.id === selectedId && (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: '#0D9488' }} />
                  )}
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No clients found.</p>
            )}
          </div>

          {/* Add new client */}
          <div className="border-t border-gray-100 p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onInlineCreate() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              style={{ color: '#0D9488' }}
            >
              <Plus className="h-4 w-4" />
              Add new client
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function NewCampaignForm({
  financeExecs,
  clients: initialClients,
}: {
  financeExecs: { id: string; full_name: string; email: string }[]
  clients: ClientOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Campaign fields
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [manualAdvertiser, setManualAdvertiser] = useState('')
  const [title, setTitle] = useState('')
  const [financeExecId, setFinanceExecId] = useState('')
  const [planReference, setPlanReference] = useState('')
  const [notes, setNotes] = useState('')

  // Client list (can grow if inline create adds one)
  const [clients, setClients] = useState<ClientOption[]>(initialClients)

  // Inline client create state
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [inlineCreating, startInlineCreate] = useTransition()
  const [inlineName, setInlineName] = useState('')
  const [inlineEmail, setInlineEmail] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null
  const advertiser = selectedClient?.client_name ?? manualAdvertiser

  function handleClientSelect(client: ClientOption | null) {
    setSelectedClientId(client?.id ?? null)
    setManualAdvertiser('')
    setShowInlineCreate(false)
  }

  function handleInlineSave() {
    if (!inlineName.trim()) { setInlineError('Client name is required.'); return }
    setInlineError(null)
    startInlineCreate(async () => {
      const result = await createClientAction({
        clientName: inlineName.trim(),
        email: inlineEmail.trim() || undefined,
      })
      if (result.error) { setInlineError(result.error); return }
      const newClient: ClientOption = {
        id: result.clientId!,
        client_name: result.clientName!,
        email: inlineEmail.trim() || null,
        cc_emails: [],
      }
      setClients((prev) => [...prev, newClient])
      setSelectedClientId(newClient.id)
      setShowInlineCreate(false)
      setInlineName('')
      setInlineEmail('')
    })
  }

  function handleSubmit() {
    if (!advertiser.trim()) { setError('Client name is required.'); return }
    if (!title.trim()) { setError('Campaign name is required.'); return }
    setError(null)

    startTransition(async () => {
      const result = await createCampaignWithClientAction({
        clientId: selectedClientId,
        advertiser: advertiser.trim(),
        title: title.trim(),
        financeExecId: financeExecId || null,
        planReference: planReference.trim() || null,
        notes: notes.trim() || null,
      })
      if (result?.error) setError(result.error)
      // On success, server action redirects
    })
  }

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Client selector */}
        <div>
          <label className={labelCls}>
            Client <span className="text-red-400">*</span>
          </label>
          <ClientSelector
            clients={clients}
            selectedId={selectedClientId}
            onSelect={handleClientSelect}
            onInlineCreate={() => setShowInlineCreate(true)}
          />

          {/* Manual entry fallback */}
          {!selectedClientId && !showInlineCreate && (
            <input
              value={manualAdvertiser}
              onChange={(e) => setManualAdvertiser(e.target.value)}
              placeholder="Or type client name manually…"
              className={`${inputCls} mt-2`}
            />
          )}

          {/* Inline create mini-form */}
          {showInlineCreate && (
            <div className="mt-3 p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">New Client</p>
                <button
                  type="button"
                  onClick={() => { setShowInlineCreate(false); setInlineName(''); setInlineEmail(''); setInlineError(null) }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                placeholder="Company name *"
                className={inputCls}
              />
              <input
                type="email"
                value={inlineEmail}
                onChange={(e) => setInlineEmail(e.target.value)}
                placeholder="Billing email (optional)"
                className={inputCls}
              />
              {inlineError && (
                <p className="text-xs text-red-600">{inlineError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInlineSave}
                  disabled={inlineCreating}
                  className="min-h-[36px] px-4 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: '#0D9488' }}
                >
                  {inlineCreating ? 'Saving…' : 'Save Client'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInlineCreate(false); setInlineName(''); setInlineEmail(''); setInlineError(null) }}
                  className="min-h-[36px] px-4 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Confirmation when client selected */}
          {selectedClient && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {selectedClient.client_name}
                {selectedClient.email && ` · ${selectedClient.email}`}
                {selectedClient.cc_emails.length > 0 &&
                  ` · ${selectedClient.cc_emails.length} CC`}
              </span>
            </div>
          )}
        </div>

        {/* Campaign Name */}
        <div>
          <label htmlFor="title" className={labelCls}>
            Campaign Name <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            type="text"
            placeholder="e.g. Q3 Brand Awareness Drive"
            className={inputCls}
          />
        </div>

        {/* Plan Reference */}
        <div>
          <label htmlFor="plan_reference" className={labelCls}>
            Plan Reference{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="plan_reference"
            value={planReference}
            onChange={(e) => setPlanReference(e.target.value)}
            type="text"
            placeholder="e.g. MPO-2026-0042"
            className={inputCls}
          />
        </div>

        {/* Finance Executive */}
        <div>
          <label htmlFor="finance_exec_id" className={labelCls}>
            Assign Finance Executive{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          {financeExecs.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
              No Finance Executives found.
            </p>
          ) : (
            <select
              id="finance_exec_id"
              value={financeExecId}
              onChange={(e) => setFinanceExecId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Unassigned —</option>
              {financeExecs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className={labelCls}>
            Notes <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional context…"
            className={`${inputCls} resize-none min-h-[80px]`}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: '#0D9488' }}
          >
            {isPending ? 'Creating…' : 'Create Campaign'}
          </button>
          <Link
            href="/campaigns"
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
