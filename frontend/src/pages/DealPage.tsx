import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw, WifiOff } from 'lucide-react'
import { useDeal } from '@/hooks/useDeal'
import { useFreighter } from '@/hooks/useFreighter'
import { useWalletStore } from '@/store/walletStore'
import { DealCard } from '@/components/deal/DealCard'
import { FundDealPanel } from '@/components/deal/FundDealPanel'
import { ConfirmReceiptButton, ClaimTimeoutButton } from '@/components/deal/DealActions'
import { ShareDealLink } from '@/components/deal/ShareDealLink'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { isTimeoutPassed } from '@/lib/utils'
import { getCurrentLedger } from '@/lib/soroban/contract'
import { useEffect } from 'react'

export function DealPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const [searchParams] = useSearchParams()
  const justCreated = searchParams.get('created') === '1'

  const { deal, loading, error, refetch } = useDeal(dealId)
  const { address } = useFreighter()
  const walletAddress = useWalletStore((s) => s.address)

  const [currentLedger, setCurrentLedger] = useState<number>(0)
  const [expired, setExpired] = useState(false)

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

  // Determine viewer role
  const isSeller = !!walletAddress && deal?.seller === walletAddress
  const isBuyer = !!walletAddress && deal?.buyer === walletAddress

  const handleActionSuccess = (txHash: string) => {
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
    setTimeout(refetch, 3000)
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
      <DealCard deal={deal} asSeller={isSeller} />

      {/* ── Buyer Actions ─────────────────────────────────── */}

      {/* Buyer: lock funds — US-002 (only when PendingPayment) */}
      {deal.status === 'PendingPayment' && !isSeller && (
        <>
          {!walletAddress ? (
            <div className="card-glass p-5 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground font-sans">
                Connect your wallet to secure this deal.
              </p>
              <ConnectWalletButton />
            </div>
          ) : (
            <FundDealPanel deal={deal} onSuccess={handleActionSuccess} />
          )}
        </>
      )}

      {/* Buyer: confirm receipt — US-003 (only when Funded and caller is buyer) */}
      {deal.status === 'Funded' && isBuyer && (
        <div className="card-glass p-5 space-y-3">
          <p className="font-display text-sm text-foreground">Did you receive the item?</p>
          <p className="text-xs text-muted-foreground font-sans">
            Confirming receipt releases payment to the seller. Only do this after you've verified the item.
          </p>
          <ConfirmReceiptButton deal={deal} onSuccess={handleActionSuccess} />
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
            onSuccess={handleActionSuccess}
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
