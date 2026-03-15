'use client'

import { useState, useRef, useCallback } from 'react'
import { Lock, Upload, Building2, FileText, Bell, Palette, Star, Pencil, Trash2, Plus } from 'lucide-react'
import {
  saveOrgProfileAction,
  saveDocSettingsAction,
  saveNotificationPrefsAction,
  createBankAccountAction,
  updateBankAccountAction,
  deleteBankAccountAction,
  setDefaultBankAccountAction,
  type BankAccountInput,
} from '@/lib/actions/settings'
import type { OrgSettings, OrgBankAccount, UserRole } from '@/types'
import { useOrgSettings } from '@/components/layout/org-settings-context'

// ── Color Picker ──────────────────────────────────────────────────────────────
function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-lg border border-gray-200 overflow-hidden cursor-pointer flex-shrink-0">
          <div style={{ background: value }} className="absolute inset-0" />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#0D9488"
          className="w-32 min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
    </div>
  )
}

// ── Mini Sidebar Preview ──────────────────────────────────────────────────────
function SidebarPreview({
  primaryColor,
  secondaryColor,
}: {
  primaryColor: string
  secondaryColor: string
}) {
  void secondaryColor
  return (
    <div className="w-48 h-64 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col text-xs">
      <div className="px-3 py-3 border-b border-gray-100 flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-md flex items-center justify-center text-white font-bold text-[10px]"
          style={{ background: primaryColor }}
        >
          R
        </div>
        <span className="font-bold text-gray-900 text-xs">Revflow</span>
      </div>
      <div className="flex-1 px-2 py-2 space-y-0.5">
        {['Dashboard', 'Campaigns', 'Clients', 'Settings'].map((item, i) => (
          <div
            key={item}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
              i === 0 ? 'text-white' : 'text-gray-500'
            }`}
            style={i === 0 ? { background: primaryColor } : {}}
          >
            <div className="h-3 w-3 bg-current rounded-sm opacity-60" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Save Banner ───────────────────────────────────────────────────────────────
function useSaveBanner() {
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(async (
    fn: () => Promise<{ error?: string; ok?: true }>,
    onSuccess?: () => void,
  ) => {
    setState('saving')
    const result = await fn()
    if (result.error) {
      setErrorMsg(result.error)
      setState('error')
    } else {
      setState('ok')
      onSuccess?.()
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setState('idle'), 3000)
  }, [])

  const banner =
    state === 'ok' ? (
      <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
        Saved successfully!
      </div>
    ) : state === 'error' ? (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        {errorMsg}
      </div>
    ) : null

  return { run, banner, saving: state === 'saving' }
}

// ── Admin Gate ────────────────────────────────────────────────────────────────
function AdminGate({ children, role }: { children: React.ReactNode; role: UserRole }) {
  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <Lock className="h-10 w-10" />
        <p className="text-sm font-medium">Admin access required</p>
        <p className="text-xs text-center max-w-xs">
          Only admins can modify this section. Contact your organisation admin to make changes.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

// ── Field Components ──────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

// ── Bank Account Form ─────────────────────────────────────────────────────────
const EMPTY_BANK_FORM: BankAccountInput = {
  bank_name: '',
  account_name: '',
  account_number: '',
  bank_code: '',
  currency: 'NGN',
  label: '',
}

function BankAccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BankAccountInput
  onSave: (input: BankAccountInput) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<BankAccountInput>(initial ?? EMPTY_BANK_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof BankAccountInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setError(null)
    if (!form.bank_name.trim()) { setError('Bank name is required.'); return }
    if (!form.account_name.trim()) { setError('Account name is required.'); return }
    if (!form.account_number.trim()) { setError('Account number is required.'); return }
    setSaving(true)
    try {
      await onSave(form)
    } catch {
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name *</label>
          <input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)}
            className={inputCls} placeholder="e.g. Zenith Bank" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
          <input value={form.account_name} onChange={(e) => set('account_name', e.target.value)}
            className={inputCls} placeholder="e.g. QVT Media Limited" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Account Number *</label>
          <input value={form.account_number} onChange={(e) => set('account_number', e.target.value)}
            className={inputCls} placeholder="e.g. 1234567890" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sort Code / Bank Code</label>
          <input value={form.bank_code ?? ''} onChange={(e) => set('bank_code', e.target.value)}
            className={inputCls} placeholder="e.g. 01-01-01" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
          <select value={form.currency ?? 'NGN'} onChange={(e) => set('currency', e.target.value)}
            className={inputCls}>
            {['NGN', 'USD', 'GBP', 'EUR'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
          <input value={form.label ?? ''} onChange={(e) => set('label', e.target.value)}
            className={inputCls} placeholder="e.g. USD Domiciliary" />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Account'}
        </button>
        <button
          onClick={onCancel}
          className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Bank Accounts Manager ─────────────────────────────────────────────────────
function BankAccountsManager({
  bankAccounts: initial,
}: {
  bankAccounts: OrgBankAccount[]
}) {
  const [accounts, setAccounts] = useState(initial)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleAdd(input: BankAccountInput) {
    const result = await createBankAccountAction(input)
    if (result.error) throw new Error(result.error)
    if (result.account) setAccounts((prev) => [...prev, result.account!])
    setShowAddForm(false)
  }

  async function handleEdit(id: string, input: BankAccountInput) {
    const result = await updateBankAccountAction(id, input)
    if (result.error) throw new Error(result.error)
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...input } : a)),
    )
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this bank account? This cannot be undone.')) return
    const result = await deleteBankAccountAction(id)
    if (result.error) { alert(result.error); return }
    const deleted = accounts.find((a) => a.id === id)
    const remaining = accounts.filter((a) => a.id !== id)
    // If deleted was default, promote first remaining
    if (deleted?.is_default && remaining.length > 0) {
      remaining[0] = { ...remaining[0], is_default: true }
    }
    setAccounts(remaining)
  }

  async function handleSetDefault(id: string) {
    const result = await setDefaultBankAccountAction(id)
    if (result.error) { alert(result.error); return }
    setAccounts((prev) =>
      prev.map((a) => ({ ...a, is_default: a.id === id })),
    )
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No bank accounts configured yet.
        </p>
      )}

      {accounts.map((account) =>
        editingId === account.id ? (
          <BankAccountForm
            key={account.id}
            initial={{
              bank_name: account.bank_name,
              account_name: account.account_name,
              account_number: account.account_number,
              bank_code: account.bank_code ?? '',
              currency: account.currency,
              label: account.label ?? '',
            }}
            onSave={(input) => handleEdit(account.id, input)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={account.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {account.label || account.bank_name}
                </span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                  {account.currency}
                </span>
                {account.is_default && (
                  <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {account.account_name} · ···{account.account_number.slice(-4)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!account.is_default && (
                <button
                  onClick={() => handleSetDefault(account.id)}
                  title="Set as default"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setEditingId(account.id)}
                title="Edit"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(account.id)}
                title="Delete"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ),
      )}

      {showAddForm ? (
        <BankAccountForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-teal-300 text-sm font-medium text-teal-700 hover:bg-teal-50 transition w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add bank account
        </button>
      )}
    </div>
  )
}

// ── Org Profile Tab ───────────────────────────────────────────────────────────
function OrgProfileTab({
  s,
  role,
}: {
  s: OrgSettings
  role: UserRole
}) {
  const [orgName, setOrgName] = useState(s.org_name ?? '')
  const [primary, setPrimary] = useState(s.primary_color)
  const [secondary, setSecondary] = useState(s.secondary_color)
  const [currency, setCurrency] = useState(s.default_currency)
  const [taxId, setTaxId] = useState(s.tax_id ?? '')
  const [rcNumber, setRcNumber] = useState(s.rc_number ?? '')
  const [address, setAddress] = useState(s.address ?? '')
  const [logoUrl, setLogoUrl] = useState(s.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const { run, banner, saving } = useSaveBanner()
  const { setOrgSettings } = useOrgSettings()

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/settings/logo-upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (json.logoUrl) {
      setLogoUrl(json.logoUrl)
      // Update sidebar immediately on upload — no save needed
      setOrgSettings({ logoUrl: json.logoUrl })
    }
    setUploading(false)
  }

  return (
    <AdminGate role={role}>
      <div className="space-y-6">
        <Field label="Organisation Name">
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="QVT Media"
            className={inputCls}
          />
        </Field>

        {/* Logo */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Logo</label>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Organisation logo"
              className="h-16 w-auto rounded-lg border border-gray-200 object-contain"
            />
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px] px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload logo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-xs text-gray-400">JPG, PNG, SVG or WebP. Max 2 MB.</p>
        </div>

        <ColorPicker label="Primary color" value={primary} onChange={setPrimary} />
        <ColorPicker label="Secondary color" value={secondary} onChange={setSecondary} />

        <Field label="Default currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {['NGN', 'USD', 'GBP', 'EUR'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Tax ID">
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} />
        </Field>

        <Field label="RC number">
          <input value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Address">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </Field>

        <div className="flex items-center gap-4 pt-2">
          <button
            disabled={saving}
            onClick={() =>
              run(
                () =>
                  saveOrgProfileAction({
                    org_name: orgName,
                    primary_color: primary,
                    secondary_color: secondary,
                    default_currency: currency,
                    tax_id: taxId,
                    rc_number: rcNumber,
                    address,
                  }),
                () =>
                  setOrgSettings({
                    primaryColor: primary,
                    secondaryColor: secondary,
                    logoUrl: logoUrl || null,
                    orgName: orgName || 'Revflow',
                  }),
              )
            }
            className="min-h-[44px] px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ background: primary }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {banner}
        </div>
      </div>
    </AdminGate>
  )
}

// ── Document Settings Tab ─────────────────────────────────────────────────────
function DocSettingsTab({
  s,
  role,
  bankAccounts,
}: {
  s: OrgSettings
  role: UserRole
  bankAccounts: OrgBankAccount[]
}) {
  const [prefix, setPrefix] = useState(s.invoice_prefix)
  const [paymentTerms, setPaymentTerms] = useState(s.payment_terms)
  const [agencyFee, setAgencyFee] = useState(String(s.agency_fee_pct))
  const { run, banner, saving } = useSaveBanner()

  const year = new Date().getFullYear()
  const normalizedPrefix =
    prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'INV'
  const formatPreview = `${normalizedPrefix}-${year}-0001`

  return (
    <AdminGate role={role}>
      <div className="space-y-6">
        <Field label="Invoice prefix">
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="INV"
            maxLength={6}
            className={inputCls}
          />
          <div className="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono text-gray-500">
            Preview: {formatPreview}
          </div>
        </Field>

        <Field label="Default payment terms">
          <select
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className={inputCls}
          >
            {['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on Receipt'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Default agency fee (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={agencyFee}
            onChange={(e) => setAgencyFee(e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="flex items-center gap-4 pt-2">
          <button
            disabled={saving}
            onClick={() =>
              run(() =>
                saveDocSettingsAction({
                  invoice_prefix: prefix,
                  payment_terms: paymentTerms,
                  agency_fee_pct: Number(agencyFee),
                }),
              )
            }
            className="min-h-[44px] px-6 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {banner}
        </div>

        {/* Bank Accounts section */}
        <div className="pt-2 border-t border-gray-100 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Bank Accounts</p>
          <p className="text-xs text-gray-400">
            These will be used as payment details on proforma and invoice emails.
            Mark one as default to use it when no client preference is set.
          </p>
          <BankAccountsManager bankAccounts={bankAccounts} />
        </div>
      </div>
    </AdminGate>
  )
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab({
  emailNotifications: initial,
  role,
}: {
  emailNotifications: boolean
  role: UserRole
}) {
  const [emailNotif, setEmailNotif] = useState(initial)
  const { run, banner, saving } = useSaveBanner()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">Receive email notifications</p>
          <p className="text-xs text-gray-500">
            Email alerts for overdue invoices, PO received, and payment confirmations.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={emailNotif}
          onClick={() => setEmailNotif(!emailNotif)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
            emailNotif ? 'bg-teal-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              emailNotif ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {role === 'admin' && (
        <p className="text-sm text-gray-500">
          <a href="/admin/timelines" className="text-teal-600 hover:underline">
            Manage timeline chase settings →
          </a>
        </p>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          disabled={saving}
          onClick={() => run(() => saveNotificationPrefsAction(emailNotif))}
          className="min-h-[44px] px-6 py-2 rounded-lg text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {banner}
      </div>
    </div>
  )
}

// ── Appearance Tab ────────────────────────────────────────────────────────────
function AppearanceTab({ s, role }: { s: OrgSettings; role: UserRole }) {
  const [primary, setPrimary] = useState(s.primary_color)
  const [secondary, setSecondary] = useState(s.secondary_color)
  const { run, banner, saving } = useSaveBanner()
  const { setOrgSettings } = useOrgSettings()

  return (
    <AdminGate role={role}>
      <div className="space-y-6">
        <p className="text-sm text-gray-500">
          Colors apply to sidebar navigation and accent elements across the app.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-6">
            <ColorPicker label="Primary color" value={primary} onChange={setPrimary} />
            <ColorPicker label="Secondary color" value={secondary} onChange={setSecondary} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Preview</p>
            <SidebarPreview primaryColor={primary} secondaryColor={secondary} />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            disabled={saving}
            onClick={() =>
              run(
                () =>
                  saveOrgProfileAction({
                    org_name: s.org_name ?? '',
                    primary_color: primary,
                    secondary_color: secondary,
                    default_currency: s.default_currency,
                    tax_id: s.tax_id ?? '',
                    rc_number: s.rc_number ?? '',
                    address: s.address ?? '',
                  }),
                () => setOrgSettings({ primaryColor: primary, secondaryColor: secondary }),
              )
            }
            className="min-h-[44px] px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ background: primary }}
          >
            {saving ? 'Saving…' : 'Save colors'}
          </button>
          {banner}
        </div>
      </div>
    </AdminGate>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'org-profile',   label: 'Organisation',    icon: Building2 },
  { id: 'doc-settings',  label: 'Documents',        icon: FileText  },
  { id: 'notifications', label: 'Notifications',    icon: Bell      },
  { id: 'appearance',    label: 'Appearance',        icon: Palette   },
] as const

type TabId = (typeof TABS)[number]['id']

export default function SettingsClient({
  orgSettings,
  emailNotifications,
  role,
  bankAccounts,
}: {
  orgSettings: OrgSettings
  emailNotifications: boolean
  role: UserRole
  bankAccounts: OrgBankAccount[]
}) {
  const [activeTab, setActiveTab] = useState<TabId>('org-profile')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 mb-6 border-b border-gray-200 min-w-max sm:min-w-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] -mb-px ${
                  isActive
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'org-profile' && <OrgProfileTab s={orgSettings} role={role} />}
        {activeTab === 'doc-settings' && (
          <DocSettingsTab s={orgSettings} role={role} bankAccounts={bankAccounts} />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab emailNotifications={emailNotifications} role={role} />
        )}
        {activeTab === 'appearance' && <AppearanceTab s={orgSettings} role={role} />}
      </div>
    </div>
  )
}
