import { Loader2, PackageCheck, Timer } from 'lucide-react'
import { useConfirmReceipt, useClaimTimeout } from '@/hooks/useContractActions'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/soroban/types'

// ─── ConfirmReceiptButton — US-003 ────────────────────────────────────────────

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
            Release Payment to Seller
          </>
        )}
      </button>

      <p className="text-xs text-muted-foreground text-center font-sans">
        Buyer only. Use this once you are ready for the seller to receive the funds immediately.
      </p>

      {error && (
        <p className="text-xs text-destructive text-center font-sans">{error}</p>
      )}
    </div>
  )
}

// ─── ClaimTimeoutButton — US-004 ──────────────────────────────────────────────

interface ClaimTimeoutButtonProps {
  deal: Deal
  isExpired: boolean
  onSuccess: (txHash: string) => void
}

export function ClaimTimeoutButton({ deal, isExpired, onSuccess }: ClaimTimeoutButtonProps) {
  const { claimTimeout, loading, error } = useClaimTimeout()

  const handleClaim = async () => {
    try {
      const txHash = await claimTimeout(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error handled in hook
    }
  }

  return (
    <div className="space-y-3">
      {/* Disabled until timeout passes — US-004 AC */}
      {!isExpired && (
        <p className="text-xs text-muted-foreground font-sans text-center">
          The "Claim Payment" button activates once the timeout window has passed.
        </p>
      )}

      <button
        onClick={handleClaim}
        disabled={!isExpired || loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'border border-primary/40 text-primary',
          'hover:bg-primary/10',
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
