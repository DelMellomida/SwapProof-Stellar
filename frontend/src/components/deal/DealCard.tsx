import { formatXlm, formatAddress } from '@/lib/utils'
import { DealStatusBadge } from './DealStatusBadge'
import { DealTimerCountdown } from './DealTimerCountdown'
import type { Deal } from '@/lib/soroban/types'
import { cn } from '@/lib/utils'

interface DealCardProps {
  deal: Deal
  className?: string
  /** Show the seller's view (hides buyer actions) */
  asSeller?: boolean
}

export function DealCard({ deal, className, asSeller = false }: DealCardProps) {
  return (
    <div className={cn('card-glass p-6 space-y-5 animate-fade-in', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-display text-muted-foreground tracking-widest uppercase mb-1">
            Deal #{deal.deal_id.toString()}
          </p>
          <h2 className="font-display text-lg text-foreground">{deal.item_name}</h2>
        </div>
        <DealStatusBadge status={deal.status} />
      </div>

      {/* Amount */}
      <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
        <p className="text-xs text-muted-foreground font-sans mb-0.5">Escrow Amount</p>
        <p className="font-display text-2xl text-gradient-teal">
          {formatXlm(deal.amount)}{' '}
          <span className="text-sm font-sans text-muted-foreground">XLM</span>
        </p>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Seller</p>
          <p className="font-display text-foreground/80">{formatAddress(deal.seller)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Buyer</p>
          <p className="font-display text-foreground/80">
            {deal.buyer ? formatAddress(deal.buyer) : '—'}
          </p>
        </div>
      </div>

      {/* Timeout */}
      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground mb-1 font-sans">
          {asSeller
            ? 'You can claim funds after the timeout if buyer does not confirm.'
            : 'Funds return to you automatically if seller does not deliver in time.'}
        </p>
        <DealTimerCountdown timeoutLedger={deal.timeout_ledger} />
      </div>
    </div>
  )
}
