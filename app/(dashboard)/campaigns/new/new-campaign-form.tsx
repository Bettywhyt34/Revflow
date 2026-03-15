'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createCampaignAction } from '@/lib/actions/campaigns'

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20'

const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function NewCampaignForm({
  financeExecs,
}: {
  financeExecs: { id: string; full_name: string; email: string }[]
}) {
  const [state, action, isPending] = useActionState(createCampaignAction, null)

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Client Name */}
        <div>
          <label htmlFor="advertiser" className={labelClass}>
            Client Name <span className="text-red-400">*</span>
          </label>
          <input
            id="advertiser"
            name="advertiser"
            type="text"
            placeholder="e.g. Dangote Cement"
            required
            className={inputClass}
          />
        </div>

        {/* Campaign Name */}
        <div>
          <label htmlFor="title" className={labelClass}>
            Campaign Name <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="e.g. Q3 Brand Awareness Drive"
            required
            className={inputClass}
          />
        </div>

        {/* Plan Reference */}
        <div>
          <label htmlFor="plan_reference" className={labelClass}>
            Plan Reference{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="plan_reference"
            name="plan_reference"
            type="text"
            placeholder="e.g. MPO-2026-0042"
            className={inputClass}
          />
        </div>

        {/* Finance Executive */}
        <div>
          <label htmlFor="finance_exec_id" className={labelClass}>
            Assign Finance Executive{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          {financeExecs.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
              No Finance Executives found. Add users with the finance_exec role first.
            </p>
          ) : (
            <select id="finance_exec_id" name="finance_exec_id" className={inputClass}>
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
          <label htmlFor="notes" className={labelClass}>
            Notes{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Any additional context…"
            className={`${inputClass} resize-none min-h-[80px]`}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: isPending ? '#0b857a' : '#0D9488' }}
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
      </form>
    </div>
  )
}
