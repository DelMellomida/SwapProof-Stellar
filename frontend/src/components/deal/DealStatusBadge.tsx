import { cn } from '@/lib/utils'
import type { DealStatus } from '@/lib/soroban/types'

interface DealStatusBadgeProps {
  status: DealStatus
  className?: string
}

const STATUS_CONFIG: Record<DealStatus, { label: string; classes: string }> = {
  PendingPayment: {
    label: 'Awaiting Buyer',
    classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
  FundedAwaitingShipment: {
    label: 'Awaiting Shipment',
    classes: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  },
  ShippedAwaitingReceipt: {
    label: 'Awaiting Receipt',
    classes: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  },
  Completed: {
    label: 'Completed',
    classes: 'bg-green-500/10 text-green-400 border-green-500/30',
  },
  Refunded: {
    label: 'Refunded',
    classes: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  },
  SellerClaimed: {
    label: 'Seller Claimed',
    classes: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  },
}

export function DealStatusBadge({ status, className }: DealStatusBadgeProps) {
  const { label, classes } = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-display tracking-wide',
        classes,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  )
}
