'use client'

import { useState, useTransition } from 'react'
import { X, Edit2 } from 'lucide-react'
import { updatePaymentWhtAction } from '@/lib/actions/payments'
import type { UserRole } from '@/types'
import type { PaymentWithRelations } from '@/lib/data/payments'

function fmt(value: number | null | undefined, currency: string): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 ' +
  'bg-white focus:outline-none focus:ring-2 focus:border-transparent transition'

function EditWhtModal({
  payment,
  campaignId,
  onClose,
  onSuccess,
}: {
  payment: PaymentWithRelations
  campaignId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [certNumber, setCertNumber] = useState(payment.wht_certificate_number ?? '')
  const [creditNote, setCreditNote] = useState(payment.wht_credit_note_number ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    startTransition(async () => {
      const result = await updatePaymentWhtAction(payment.id, campaignId, certNumber, creditNote)
      if (result.error) { setError(result.error); return }
      onSuccess()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Edit WHT Details</h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WHT Certificate Number</label>
            <input
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. WHT-2026-001"
              className={inputCls}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WHT Credit Note Number</label>
            <input
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              placeholder="e.g. CN-2026-001"
              className={inputCls}
              style={{ '--tw-ring-color': '#0D9488' } as React.CSSProperties}
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: '#0D9488' }}
            onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#0b857a' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0D9488' }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentHistory({
  payments,
  finalBillable,
  currency,
  campaignId,
  userRole,
  onRefresh,
}: {
  payments: PaymentWithRelations[]
  finalBillable: number | null
  currency: string
  campaignId: string
  userRole: UserRole
  onRefresh: () => void
}) {
  const [editPayment, setEditPayment] = useState<PaymentWithRelations | null>(null)

  const canEdit = userRole === 'admin' || userRole === 'finance_exec'
  const totalWht = payments.reduce((sum, p) => sum + (p.wht_amount ?? 0), 0)
  const totalCash = payments.reduce((sum, p) => sum + (p.actual_cash_received ?? p.amount ?? 0), 0)
  const totalSettled = payments.reduce((sum, p) => sum + (p.total_settled ?? p.amount ?? 0), 0)

  // Running balance (cumulative)
  let cumulativeSettled = 0

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Payment History</h2>
        <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Payment History</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Date</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden sm:table-cell">Invoice</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Cash</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden md:table-cell">WHT</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">Settled</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Balance</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden md:table-cell">Method</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Ref</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 hidden lg:table-cell">Cert #</th>
              {canEdit && <th className="pb-2 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {payments.map((p) => {
              const settled = p.total_settled ?? p.amount ?? 0
              cumulativeSettled += settled
              const runningBalance = finalBillable != null ? finalBillable - cumulativeSettled : null

              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                  <td className="py-3 pr-4 text-gray-500 hidden sm:table-cell">
                    {p.document?.document_number ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium text-gray-900 whitespace-nowrap">
                    {fmt(p.actual_cash_received ?? p.amount, currency)}
                  </td>
                  <td className="py-3 pr-4 text-right hidden md:table-cell whitespace-nowrap">
                    {p.wht_amount && p.wht_amount > 0 ? (
                      <span className="text-amber-700">{fmt(p.wht_amount, currency)}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {fmt(settled, currency)}
                  </td>
                  <td className="py-3 pr-4 text-right hidden lg:table-cell whitespace-nowrap">
                    {runningBalance != null ? (
                      <span className={runningBalance <= 0 ? 'text-green-600 font-semibold' : 'text-gray-700'}>
                        {runningBalance <= 0 ? 'Paid' : fmt(runningBalance, currency)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-gray-500 capitalize hidden md:table-cell">
                    {p.payment_method.replace('_', ' ')}
                  </td>
                  <td className="py-3 pr-4 text-gray-400 hidden lg:table-cell max-w-[120px] truncate">
                    {p.reference ?? '—'}
                  </td>
                  <td className="py-3 text-gray-400 hidden lg:table-cell max-w-[120px] truncate">
                    {p.wht_certificate_number ?? '—'}
                  </td>
                  {canEdit && (
                    <td className="py-3 pl-2">
                      {(p.wht_applicable || p.wht_amount > 0) && (
                        <button
                          onClick={() => setEditPayment(p)}
                          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
                          title="Edit WHT details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="py-3 pr-4 text-xs font-bold text-gray-500 uppercase">Total</td>
              <td className="hidden sm:table-cell" />
              <td className="py-3 pr-4 text-right font-bold text-gray-900">{fmt(totalCash, currency)}</td>
              <td className="py-3 pr-4 text-right hidden md:table-cell">
                {totalWht > 0 ? (
                  <span className="font-bold text-amber-700">{fmt(totalWht, currency)}</span>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-3 pr-4 text-right font-bold text-gray-900">{fmt(totalSettled, currency)}</td>
              <td className="hidden lg:table-cell" colSpan={4} />
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* WHT Credits summary */}
      {totalWht > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">WHT Credits</p>
          <div className="flex flex-wrap gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-amber-700">Total WHT Credits: </span>
              <span className="font-bold text-amber-900">{fmt(totalWht, currency)}</span>
            </div>
            {payments
              .filter((p) => p.wht_certificate_number)
              .map((p) => (
                <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
                  Cert: <span className="font-mono font-semibold">{p.wht_certificate_number}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {editPayment && (
        <EditWhtModal
          payment={editPayment}
          campaignId={campaignId}
          onClose={() => setEditPayment(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
