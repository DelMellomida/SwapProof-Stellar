import { formatAddress, formatLedgerWindow, formatXlm } from '@/lib/utils'
import { DealStatusBadge } from './DealStatusBadge'
import { DealTimerCountdown } from './DealTimerCountdown'
import type { Deal } from '@/lib/soroban/types'
import { cn } from '@/lib/utils'

interface DealCardProps {
  deal: Deal
  className?: string
  viewerRole?: 'seller' | 'buyer' | 'visitor'
}

function getStatusCopy(deal: Deal, viewerRole: DealCardProps['viewerRole']): string {
  if (deal.status === 'PendingPayment') {
    return viewerRole === 'seller'
      ? 'This deal is open and waiting for a buyer to lock the escrow.'
      : 'Once you lock the funds, the seller must mark shipment before the shipping deadline or you can refund.'
  }

  if (deal.status === 'FundedAwaitingShipment') {
    if (viewerRole === 'seller') {
      return 'Your buyer funded this deal. Mark it as shipped before the shipping deadline to keep it moving.'
    }

    if (viewerRole === 'buyer') {
      return 'Your funds are secured. If the seller misses the shipping deadline, you can reclaim your escrow.'
    }

    return 'This deal is funded and reserved for one buyer while the seller prepares shipment.'
  }

  if (deal.status === 'ShippedAwaitingReceipt') {
    if (viewerRole === 'buyer') {
      return 'The seller marked this deal as shipped. Confirm receipt when it arrives or the seller can claim after your review window ends.'
    }

    if (viewerRole === 'seller') {
      return 'Shipment is recorded on-chain. The buyer can confirm now, or you can claim after their review window ends.'
    }

    return 'This deal is already shipped and is waiting on the funded buyer to confirm receipt.'
  }

  if (deal.status === 'Completed') {
    return 'The buyer confirmed receipt and the escrow was released to the seller.'
  }

  if (deal.status === 'Refunded') {
    return 'The buyer reclaimed the escrow after the seller missed the shipping deadline.'
  }

  return 'The seller claimed the escrow after shipment was marked and the buyer review window expired.'
}

export function DealCard({ deal, className, viewerRole = 'visitor' }: DealCardProps) {
  return (
    <div className={cn('card-glass p-6 space-y-5 animate-fade-in', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-display text-muted-foreground tracking-widest uppercase mb-1">
            Deal #{deal.deal_id.toString()}
          </p>
          <h2 className="font-display text-lg text-foreground">{deal.item_name}</h2>
        </div>
        <DealStatusBadge status={deal.status} />
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
        <p className="text-xs text-muted-foreground font-sans mb-0.5">Escrow Amount</p>
        <p className="font-display text-2xl text-gradient-teal">
          {formatXlm(deal.amount)}{' '}
          <span className="text-sm font-sans text-muted-foreground">XLM</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Seller</p>
          <p className="font-display text-foreground/80">{formatAddress(deal.seller)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Buyer</p>
          <p className="font-display text-foreground/80">
            {deal.buyer ? formatAddress(deal.buyer) : '-'}
          </p>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground font-sans">
          {getStatusCopy(deal, viewerRole)}
        </p>

        <div className="grid gap-3 text-sm">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Shipping Deadline
            </p>
            <DealTimerCountdown
              deadlineLedger={deal.ship_deadline_ledger}
              passedLabel="Shipping deadline missed"
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Buyer Review Window
            </p>
            {deal.buyer_confirm_deadline_ledger ? (
              <DealTimerCountdown
                deadlineLedger={deal.buyer_confirm_deadline_ledger}
                passedLabel="Buyer review window ended"
              />
            ) : (
              <p className="text-sm text-muted-foreground font-sans">
                {formatLedgerWindow(deal.buyer_confirm_window_ledgers)} starts once the seller marks shipment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
