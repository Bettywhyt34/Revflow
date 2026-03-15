import { cn } from '@/lib/utils'
import type { CampaignStatus } from '@/types'

type ActionConfig = { label: string; classes: string; dotColor: string }

const ACTION_CONFIG: Record<CampaignStatus, ActionConfig> = {
  draft:               { label: 'Upload Plan',        classes: 'bg-gray-100 text-gray-500',           dotColor: 'bg-gray-400' },
  plan_submitted:      { label: 'Create Proforma',    classes: 'bg-teal-50 text-teal-700 border border-teal-200',     dotColor: 'bg-teal-500' },
  proforma_sent:       { label: 'Awaiting PO',        classes: 'bg-amber-50 text-amber-700 border border-amber-200',   dotColor: 'bg-amber-400' },
  po_received:         { label: 'Raise Invoice',      classes: 'bg-blue-50 text-blue-700 border border-blue-200',     dotColor: 'bg-blue-500' },
  invoice_sent:        { label: 'Awaiting Payment',   classes: 'bg-amber-50 text-amber-700 border border-amber-200',   dotColor: 'bg-amber-400' },
  partially_paid:      { label: 'Chase Balance',      classes: 'bg-orange-50 text-orange-700 border border-orange-200', dotColor: 'bg-orange-400' },
  fully_paid:          { label: 'Upload Compliance',  classes: 'bg-purple-50 text-purple-700 border border-purple-200', dotColor: 'bg-purple-500' },
  compliance_uploaded: { label: 'Review & Close',     classes: 'bg-teal-50 text-teal-700 border border-teal-200',     dotColor: 'bg-teal-500' },
  closed:              { label: 'Complete',            classes: 'bg-green-100 text-green-700',         dotColor: 'bg-green-500' },
  cancelled:           { label: 'Cancelled',           classes: 'bg-red-50 text-red-600 border border-red-200',        dotColor: 'bg-red-400' },
}

export default function NextActionBadge({
  status,
  className,
}: {
  status: CampaignStatus
  className?: string
}) {
  const config = ACTION_CONFIG[status] ?? ACTION_CONFIG.draft
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        config.classes,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dotColor)} />
      {config.label}
    </span>
  )
}
