import Link from 'next/link'
import type { QueueItem } from '@/lib/data/dashboard'

interface MyQueueProps {
  items: QueueItem[]
}

const PRIORITY_CONFIG = {
  OVERDUE: { color: 'bg-red-100 text-red-800 border-red-200', border: 'border-l-red-500', label: 'Overdue' },
  ESCALATE: { color: 'bg-orange-100 text-orange-800 border-orange-200', border: 'border-l-orange-500', label: 'Escalate' },
  CHASE: { color: 'bg-amber-100 text-amber-800 border-amber-200', border: 'border-l-amber-500', label: 'Chase' },
  ACTION: { color: 'bg-blue-100 text-blue-800 border-blue-200', border: 'border-l-blue-500', label: 'Action' },
  COMPLIANCE: { color: 'bg-purple-100 text-purple-800 border-purple-200', border: 'border-l-purple-500', label: 'Compliance' },
  AWAITING: { color: 'bg-gray-100 text-gray-700 border-gray-200', border: 'border-l-gray-400', label: 'Awaiting' },
}

const PRIORITY_ORDER: QueueItem['priority'][] = ['OVERDUE', 'ESCALATE', 'CHASE', 'ACTION', 'COMPLIANCE', 'AWAITING']

export default function MyQueue({ items }: MyQueueProps) {
  if (items.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <div className="text-4xl mb-3">✓</div>
        <p className="text-muted-foreground">No items requiring attention</p>
      </div>
    )
  }

  const grouped = new Map<QueueItem['priority'], QueueItem[]>()
  for (const item of items) {
    if (!grouped.has(item.priority)) grouped.set(item.priority, [])
    grouped.get(item.priority)!.push(item)
  }

  return (
    <div className="space-y-4">
      {PRIORITY_ORDER.map((priority) => {
        const group = grouped.get(priority)
        if (!group || group.length === 0) return null
        const cfg = PRIORITY_CONFIG[priority]

        return (
          <div key={priority}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cfg.color}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">{group.length} item{group.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-1.5">
              {group.map((item) => (
                <Link
                  key={item.campaignId}
                  href={item.actionHref}
                  className={`flex items-center gap-3 p-3 bg-card border border-l-4 ${cfg.border} rounded-lg hover:bg-muted/50 transition-colors min-h-[52px]`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{item.clientName}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.campaignTitle}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.issue}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.days > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.days}d</span>
                    )}
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
