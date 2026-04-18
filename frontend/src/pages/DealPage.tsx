import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw, WifiOff } from 'lucide-react'
import { useDeal } from '@/hooks/useDeal'
import { useWalletStore } from '@/store/walletStore'
import { DealCard } from '@/components/deal/DealCard'
import { FundDealPanel } from '@/components/deal/FundDealPanel'
import { ConfirmReceiptButton, ClaimTimeoutButton } from '@/components/deal/DealActions'
import { ShareDealLink } from '@/components/deal/ShareDealLink'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { isTimeoutPassed } from '@/lib/utils'
import { getCurrentLedger } from '@/lib/soroban/contract'
import { useEffect } from 'react'
import type { DealStatus } from '@/lib/soroban/types'

const CHAIN_SYNC_TIMEOUT_MS = 45_000

export function DealPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === '1'

  const { deal, loading, error, refetch } = useDeal(dealId)
  const walletAddress = useWalletStore((s) => s.address)

  const [currentLedger, setCurrentLedger] = useState<number>(0)
  const [expired, setExpired] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<DealStatus | null>(null)
  const [pendingStatusStartedAt, setPendingStatusStartedAt] = useState<number | null>(null)

  // Poll current ledger to know when timeout passes
  useEffect(() => {
    const poll = async () => {
      try {
        const ledger = await getCurrentLedger()
        setCurrentLedger(ledger)
      } catch { /* silently ignore */ }
    }
    poll()
    const id = setInterval(poll, 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (deal && currentLedger > 0) {
      setExpired(isTimeoutPassed(deal.timeout_ledger, currentLedger))
    }
  }, [deal, currentLedger])

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

  // Determine viewer role
  const isSeller = !!walletAddress && deal?.seller === walletAddress
  const isBuyer = !!walletAddress && deal?.buyer === walletAddress
  const viewerRole = isSeller ? 'seller' : isBuyer ? 'buyer' : 'visitor'

  const handleActionSuccess = (txHash: string, expectedStatus: DealStatus) => {
    setPendingStatus(expectedStatus)
    setPendingStatusStartedAt(Date.now())

    toast.success('Transaction confirmed!', {
      description: (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
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

  const waitingForFundedState =
    pendingStatus === 'Funded' &&
    deal?.status === 'PendingPayment' &&
    !!walletAddress &&
    !isSeller

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

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-10 space-y-6">
      {/* Post-creation share panel — US-006 */}
      {justCreated && (
        <div className="card-glass border-primary/20 p-5 animate-fade-in space-y-3">
          <p className="text-xs font-display text-primary uppercase tracking-widest">Deal Created ✓</p>
          <ShareDealLink dealId={deal.deal_id} />
        </div>
      )}

      {/* Deal card — always visible (US-005, US-007) */}
      <DealCard deal={deal} viewerRole={viewerRole} />

      {deal.status === 'Funded' && isBuyer && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-green-300 uppercase tracking-[0.2em]">
            Buyer Action Needed
          </p>
          <p className="font-display text-base text-foreground">
            You already locked the funds. You can release them to the seller right now.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            If you do nothing, the seller will still be able to claim the payment once the timeout passes.
          </p>
        </div>
      )}

      {waitingForFundedState && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-primary uppercase tracking-[0.2em]">
            Updating Deal State
          </p>
          <p className="font-display text-base text-foreground">
            Your funding transaction went through. Loading the buyer confirmation step now.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            Once the blockchain reflects the funded state here, you'll see the release payment action instead of the lock funds button.
          </p>
        </div>
      )}

      {deal.status === 'Funded' && !isBuyer && !isSeller && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-2 animate-fade-in">
          <p className="text-xs font-display text-muted-foreground uppercase tracking-[0.2em]">
            Deal Unavailable
          </p>
          <p className="font-display text-base text-foreground">
            This item is already funded by another buyer.
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            Only the wallet that funded this deal can release the payment now.
          </p>
        </div>
      )}

      {/* ── Buyer Actions ─────────────────────────────────── */}

      {/* Buyer: lock funds — US-002 (only when PendingPayment) */}
      {deal.status === 'PendingPayment' && !isSeller && !waitingForFundedState && (
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
              onSuccess={(txHash) => handleActionSuccess(txHash, 'Funded')}
            />
          )}
        </>
      )}

      {/* Buyer: confirm receipt — US-003 (only when Funded and caller is buyer) */}
      {deal.status === 'Funded' && isBuyer && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Release payment to the seller</p>
          <p className="text-xs text-muted-foreground font-sans">
            You are the funded buyer for this deal. Use this to send the escrowed funds to the seller immediately.
          </p>
          <ConfirmReceiptButton
            deal={deal}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'Completed')}
          />
        </div>
      )}

      {/* ── Seller Actions ─────────────────────────────────── */}

      {/* Seller: claim timeout — US-004 (only when Funded) */}
      {deal.status === 'Funded' && isSeller && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Claim your payment</p>
          <p className="text-xs text-muted-foreground font-sans">
            Once the timeout passes and the buyer hasn't confirmed, you can claim the escrow funds.
          </p>
          <ClaimTimeoutButton
            deal={deal}
            isExpired={expired}
            onSuccess={(txHash) => handleActionSuccess(txHash, 'TimedOut')}
          />
        </div>
      )}

      {/* Terminal states */}
      {(deal.status === 'Completed' || deal.status === 'TimedOut') && (
        <div className="card-glass border-border/50 p-5 text-center space-y-2">
          <p className="font-display text-sm text-muted-foreground">
            {deal.status === 'Completed' ? 'This deal has been completed.' : 'This deal timed out.'}
          </p>
          <p className="text-xs text-muted-foreground font-sans">
            No further actions are possible. The deal is permanently closed on-chain.
          </p>
        </div>
      )}
    </div>
  )
}
