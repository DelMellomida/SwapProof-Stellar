import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw, WifiOff } from 'lucide-react'
import { useDeal } from '@/hooks/useDeal'
import { useWalletStore } from '@/store/walletStore'
import { DealCard } from '@/components/deal/DealCard'
import { FundDealPanel } from '@/components/deal/FundDealPanel'
import {
  ClaimRefundButton,
  ClaimSellerTimeoutButton,
  ConfirmReceiptButton,
  MarkShippedButton,
} from '@/components/deal/DealActions'
import { ShareDealLink } from '@/components/deal/ShareDealLink'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { getStellarExpertTxUrl, isTimeoutPassed } from '@/lib/utils'
import { getCurrentLedger } from '@/lib/soroban/contract'
import type { DealStatus } from '@/lib/soroban/types'

const CHAIN_SYNC_TIMEOUT_MS = 45_000

export function DealPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === '1'

  const { deal, loading, error, refetch } = useDeal(dealId)
  const walletAddress = useWalletStore((s) => s.address)

  const [currentLedger, setCurrentLedger] = useState<number>(0)
  const [pendingStatus, setPendingStatus] = useState<DealStatus | null>(null)
  const [pendingStatusStartedAt, setPendingStatusStartedAt] = useState<number | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const ledger = await getCurrentLedger()
        setCurrentLedger(ledger)
      } catch {
        // keep existing state
      }
    }

    void poll()
    const id = setInterval(() => {
      void poll()
    }, 15_000)

    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!pendingStatus || !deal) return

    if (deal.status === pendingStatus) {
      setPendingStatus(null)
      setPendingStatusStartedAt(null)
      return
    }

    const startedAt = pendingStatusStartedAt ?? Date.now()
    if (!pendingStatusStartedAt) {
      setPendingStatusStartedAt(startedAt)
    }

    if (Date.now() - startedAt >= CHAIN_SYNC_TIMEOUT_MS) {
      setPendingStatus(null)
      setPendingStatusStartedAt(null)
      toast.info('Blockchain sync is taking longer than expected. Refreshing the deal may help.')
      return
    }

    const id = window.setTimeout(() => {
      refetch()
    }, 2_000)

    return () => window.clearTimeout(id)
  }, [deal, pendingStatus, pendingStatusStartedAt, refetch])

  const isSeller = !!walletAddress && deal?.seller === walletAddress
  const isBuyer = !!walletAddress && deal?.buyer === walletAddress
  const viewerRole = isSeller ? 'seller' : isBuyer ? 'buyer' : 'visitor'

  const handleActionSuccess = (txHash: string, expectedStatus: DealStatus) => {
    setPendingStatus(expectedStatus)
    setPendingStatusStartedAt(Date.now())

    toast.success('Transaction confirmed!', {
      description: (
        <a
          href={getStellarExpertTxUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-primary underline"
        >
          View on Stellar Expert <ExternalLink className="h-3 w-3" />
        </a>
      ),
    })
    refetch()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 flex flex-col items-center gap-3 text-center">
        <RefreshCw className="h-6 w-6 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-sans">Loading deal from blockchain...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 flex flex-col items-center gap-4 text-center">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-display text-base text-foreground mb-1">Couldn't load this deal</p>
          <p className="text-sm text-muted-foreground font-sans">{error}</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    )
  }

  if (!deal) return null

  const shipDeadlineExpired =
    currentLedger > 0 && isTimeoutPassed(deal.ship_deadline_ledger, currentLedger)

  const buyerConfirmDeadlineExpired =
    currentLedger > 0 &&
    !!deal.buyer_confirm_deadline_ledger &&
    isTimeoutPassed(deal.buyer_confirm_deadline_ledger, currentLedger)

  const waitingForStatusChange = !!pendingStatus && deal.status !== pendingStatus

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-10 space-y-6">
      {justCreated && (
        <div className="card-glass border-primary/20 p-5 animate-fade-in space-y-3">
          <p className="text-xs font-display text-primary uppercase tracking-widest">Deal Created</p>
          <ShareDealLink dealId={deal.deal_id} />
        </div>
      )}

      <DealCard deal={deal} viewerRole={viewerRole} />

      {deal.status === 'FundedAwaitingShipment' && isBuyer && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-blue-300 uppercase tracking-[0.2em]">
            Funds Secured
          </p>
          <p className="font-display text-base text-foreground">
            Your escrow is locked. The seller still needs to mark this item as shipped.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If the shipping deadline passes first, you can reclaim the funds to your wallet.
          </p>
        </div>
      )}

      {deal.status === 'ShippedAwaitingReceipt' && isBuyer && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-green-300 uppercase tracking-[0.2em]">
            Buyer Action Needed
          </p>
          <p className="font-display text-base text-foreground">
            The seller marked this item as shipped. Confirm once it reaches you.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If you stay inactive after the buyer review window ends, the seller can claim the escrow.
          </p>
        </div>
      )}

      {deal.status === 'FundedAwaitingShipment' && isSeller && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-primary uppercase tracking-[0.2em]">
            Seller Action Needed
          </p>
          <p className="font-display text-base text-foreground">
            Your buyer funded this deal. Mark it as shipped before the shipping deadline.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If you miss that deadline, the buyer becomes eligible to refund themselves from escrow.
          </p>
        </div>
      )}

      {deal.status === 'ShippedAwaitingReceipt' && isSeller && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-primary uppercase tracking-[0.2em]">
            Awaiting Buyer
          </p>
          <p className="font-display text-base text-foreground">
            Shipment is logged on-chain. The buyer can confirm now.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If the buyer review window expires without confirmation, you can claim the escrow.
          </p>
        </div>
      )}

      {waitingForStatusChange && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-primary uppercase tracking-[0.2em]">
            Updating Deal State
          </p>
          <p className="font-display text-base text-foreground">
            Your transaction went through. Waiting for the blockchain to reflect the new deal phase.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If this takes longer than expected, refreshing the page may help.
          </p>
        </div>
      )}

      {deal.status === 'FundedAwaitingShipment' && !isBuyer && !isSeller && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-muted-foreground uppercase tracking-[0.2em]">
            Deal Reserved
          </p>
          <p className="font-display text-base text-foreground">
            This deal is already funded by another buyer.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            The seller now needs to mark shipment for the funded buyer.
          </p>
        </div>
      )}

      {deal.status === 'ShippedAwaitingReceipt' && !isBuyer && !isSeller && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-muted-foreground uppercase tracking-[0.2em]">
            Awaiting Buyer Receipt
          </p>
          <p className="font-display text-base text-foreground">
            This deal is already in progress for another buyer.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            Only the funded buyer can confirm receipt, and only the seller can claim after the review window ends.
          </p>
        </div>
      )}

      {deal.status === 'PendingPayment' && !isSeller && !waitingForStatusChange && (
        <>
          {!walletAddress ? (
            <div className="card-glass p-5 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground font-sans">
                Connect your wallet to secure this deal.
              </p>
              <ConnectWalletButton />
            </div>
          ) : (
            <FundDealPanel
              deal={deal}
              onSuccess={(txHash) => handleActionSuccess(txHash, 'FundedAwaitingShipment')}
            />
          )}
        </>
      )}

      {deal.status === 'FundedAwaitingShipment' && isBuyer && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Refund if shipment never happens</p>
          <p className="text-xs text-muted-foreground font-sans">
            Your refund becomes available only if the seller misses the shipping deadline without marking the item as shipped.
          </p>
          <ClaimRefundButton
            deal={deal}
            isExpired={shipDeadlineExpired}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'Refunded')}
          />
        </div>
      )}

      {deal.status === 'FundedAwaitingShipment' && isSeller && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Mark shipment</p>
          <p className="text-xs text-muted-foreground font-sans">
            Once you have actually shipped the item, mark it here to start the buyer review window.
          </p>
          <MarkShippedButton
            deal={deal}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'ShippedAwaitingReceipt')}
          />
        </div>
      )}

      {deal.status === 'ShippedAwaitingReceipt' && isBuyer && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Confirm delivery</p>
          <p className="text-xs text-muted-foreground font-sans">
            You are the funded buyer for this deal. Confirm only after the item reaches you.
          </p>
          <ConfirmReceiptButton
            deal={deal}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'Completed')}
          />
        </div>
      )}

      {deal.status === 'ShippedAwaitingReceipt' && isSeller && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Claim after buyer inactivity</p>
          <p className="text-xs text-muted-foreground font-sans">
            If the buyer review window expires without a receipt confirmation, you can claim the escrow here.
          </p>
          <ClaimSellerTimeoutButton
            deal={deal}
            isExpired={buyerConfirmDeadlineExpired}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'SellerClaimed')}
          />
        </div>
      )}

      {(deal.status === 'Completed' || deal.status === 'Refunded' || deal.status === 'SellerClaimed') && (
        <div className="card-glass border-border/50 p-5 text-center space-y-2">
          <p className="font-display text-sm text-muted-foreground">
            {deal.status === 'Completed' && 'This deal has been completed.'}
            {deal.status === 'Refunded' && 'This deal was refunded to the buyer.'}
            {deal.status === 'SellerClaimed' && 'The seller claimed the escrow after the buyer review window ended.'}
          </p>
          <p className="text-xs text-muted-foreground font-sans">
            No further actions are possible. This deal is permanently closed on-chain.
          </p>
        </div>
      )}
    </div>
  )
}
