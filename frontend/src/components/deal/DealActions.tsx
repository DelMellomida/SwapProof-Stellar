import { Loader2, PackageCheck, PackageOpen, RotateCcw, Timer } from 'lucide-react'
import {
  useClaimRefund,
  useClaimSellerTimeout,
  useConfirmReceipt,
  useMarkShipped,
} from '@/hooks/useContractActions'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/soroban/types'

interface ConfirmReceiptButtonProps {
  deal: Deal
  onSuccess: (txHash: string) => void
}

export function ConfirmReceiptButton({ deal, onSuccess }: ConfirmReceiptButtonProps) {
  const { confirmReceipt, loading, error } = useConfirmReceipt()

  const handleConfirm = async () => {
    const confirmed = window.confirm(
      `Release payment for "${deal.item_name}" to the seller now? This cannot be undone.`,
    )
    if (!confirmed) return
    try {
      const txHash = await confirmReceipt(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleConfirm}
        disabled={loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'bg-green-500 text-white hover:bg-green-400',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
          'shadow-[0_0_20px_rgba(34,197,94,0.2)]',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Releasing Payment...
          </>
        ) : (
          <>
            <PackageCheck className="h-4 w-4" />
            Confirm Receipt and Pay Seller
          </>
        )}
      </button>

      <p className="text-xs text-muted-foreground text-center font-sans">
        Buyer only. Use this once the item has actually arrived and you are ready to release the escrow.
      </p>

      {error && (
        <p className="text-xs text-destructive text-center font-sans">{error}</p>
      )}
    </div>
  )
}

interface MarkShippedButtonProps {
  deal: Deal
  onSuccess: (txHash: string) => void
}

export function MarkShippedButton({ deal, onSuccess }: MarkShippedButtonProps) {
  const { markShipped, loading, error } = useMarkShipped()

  const handleMarkShipped = async () => {
    const confirmed = window.confirm(
      `Mark "${deal.item_name}" as shipped? This starts the buyer review window on-chain.`,
    )
    if (!confirmed) return
    try {
      const txHash = await markShipped(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleMarkShipped}
        disabled={loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'bg-primary text-primary-foreground glow-teal hover:bg-primary/90',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating Shipment...
          </>
        ) : (
          <>
            <PackageOpen className="h-4 w-4" />
            Mark Item as Shipped
          </>
        )}
      </button>

      <p className="text-xs text-muted-foreground text-center font-sans">
        Seller only. Use this when you have actually shipped the item and want the buyer review window to begin.
      </p>

      {error && (
        <p className="text-xs text-destructive text-center font-sans">{error}</p>
      )}
    </div>
  )
}

interface ClaimRefundButtonProps {
  deal: Deal
  isExpired: boolean
  onSuccess: (txHash: string) => void
}

export function ClaimRefundButton({ deal, isExpired, onSuccess }: ClaimRefundButtonProps) {
  const { claimRefund, loading, error } = useClaimRefund()

  const handleRefund = async () => {
    const confirmed = window.confirm(
      `Claim a refund for "${deal.item_name}" now? This sends the escrowed funds back to your wallet.`,
    )
    if (!confirmed) return
    try {
      const txHash = await claimRefund(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="space-y-3">
      {!isExpired && (
        <p className="text-xs text-muted-foreground font-sans text-center">
          Refund becomes available only if the shipping deadline passes before the seller marks the item as shipped.
        </p>
      )}

      <button
        onClick={handleRefund}
        disabled={!isExpired || loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'border border-orange-500/40 text-orange-300 hover:bg-orange-500/10',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Refunding...
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" />
            Claim Refund
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-destructive text-center font-sans">{error}</p>
      )}
    </div>
  )
}

interface ClaimSellerTimeoutButtonProps {
  deal: Deal
  isExpired: boolean
  onSuccess: (txHash: string) => void
}

export function ClaimSellerTimeoutButton({ deal, isExpired, onSuccess }: ClaimSellerTimeoutButtonProps) {
  const { claimSellerTimeout, loading, error } = useClaimSellerTimeout()

  const handleClaim = async () => {
    try {
      const txHash = await claimSellerTimeout(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="space-y-3">
      {!isExpired && (
        <p className="text-xs text-muted-foreground font-sans text-center">
          This activates only after the buyer review window ends without a receipt confirmation.
        </p>
      )}

      <button
        onClick={handleClaim}
        disabled={!isExpired || loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'border border-primary/40 text-primary hover:bg-primary/10',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
          isExpired && 'animate-pulse-teal',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Claiming...
          </>
        ) : (
          <>
            <Timer className="h-4 w-4" />
            Claim Payment
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-destructive text-center font-sans">{error}</p>
      )}
    </div>
  )
}
