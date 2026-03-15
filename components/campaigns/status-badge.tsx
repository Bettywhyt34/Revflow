import { cn } from '@/lib/utils'
import type { CampaignStatus } from '@/types'

const STATUS_CONFIG: Record<CampaignStatus, { label: string; classes: string }> = {
  draft:                { label: 'Draft',              classes: 'bg-gray-100 text-gray-600' },
  plan_submitted:       { label: 'Plan Submitted',     classes: 'bg-teal-50 text-teal-700 border border-teal-200' },
  proforma_sent:        { label: 'Proforma Sent',      classes: 'bg-blue-50 text-blue-700 border border-blue-200' },
  po_received:          { label: 'PO Received',        classes: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  invoice_sent:         { label: 'Invoice Sent',       classes: 'bg-amber-50 text-amber-700 border border-amber-200' },
  partially_paid:       { label: 'Partially Paid',     classes: 'bg-orange-50 text-orange-700 border border-orange-200' },
  fully_paid:           { label: 'Fully Paid',         classes: 'bg-green-50 text-green-700 border border-green-200' },
  compliance_uploaded:  { label: 'Compliance Uploaded', classes: 'bg-purple-50 text-purple-700 border border-purple-200' },
  closed:               { label: 'Closed',             classes: 'bg-green-100 text-green-800' },
  cancelled:            { label: 'Cancelled',          classes: 'bg-red-50 text-red-600 border border-red-200' },
}

export default function StatusBadge({
  status,
  className,
}: {
  status: CampaignStatus
  className?: string
}) {
  const config = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        config.classes,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
