import { useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Lock } from 'lucide-react'
import { useFundDeal } from '@/hooks/useContractActions'
import { copyToClipboard, formatAddress, formatXlm, getStellarExpertAccountUrl } from '@/lib/utils'
import { DealTimerCountdown } from './DealTimerCountdown'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/soroban/types'

interface FundDealPanelProps {
  deal: Deal
  onSuccess: (txHash: string) => void
}

export function FundDealPanel({ deal, onSuccess }: FundDealPanelProps) {
  const { fundDeal, loading, error } = useFundDeal()
  const [confirmed, setConfirmed] = useState(false)
  const [copiedSeller, setCopiedSeller] = useState(false)

  const handleFund = async () => {
    try {
      const txHash = await fundDeal(deal.deal_id)
      onSuccess(txHash)
    } catch {
      // error state handled in hook
    }
  }

  const handleCopySeller = async () => {
    await copyToClipboard(deal.seller)
    setCopiedSeller(true)
    window.setTimeout(() => setCopiedSeller(false), 2500)
  }

  const sellerHistoryUrl = getStellarExpertAccountUrl(deal.seller)

  return (
    <div className="card-glass p-6 space-y-6 animate-fade-in">
      <div>
        <h3 className="font-display text-base text-foreground mb-1">Deal Summary</h3>
        <p className="text-xs text-muted-foreground font-sans">
          Review all terms before locking your funds. This action cannot be undone.
        </p>
      </div>

      {/* Terms grid - US-008 */}
      <dl className="space-y-3 text-sm">
        {[
          { label: 'Item', value: deal.item_name },
          {
            label: 'Amount',
            value: (
              <span className="font-display text-primary">
                {formatXlm(deal.amount)} XLM
              </span>
            ),
          },
          { label: 'Seller', value: formatAddress(deal.seller) },
          {
            label: 'Timeout',
            value: (
              <DealTimerCountdown timeoutLedger={deal.timeout_ledger} />
            ),
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div>
          <p className="text-xs font-display uppercase tracking-widest text-primary">
            Seller Trust Check
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-sans leading-relaxed">
            Check the seller wallet before locking funds. You can copy the address or inspect its public blockchain activity.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/40 px-3 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Full Seller Address
          </p>
          <p className="break-all font-mono text-xs text-foreground">
            {deal.seller}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleCopySeller}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-display transition-all',
              copiedSeller
                ? 'bg-green-500/20 text-green-400'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
          >
            {copiedSeller ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Seller Address
              </>
            )}
          </button>

          <a
            href={sellerHistoryUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-display text-foreground transition-all hover:border-primary/30 hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Seller History
          </a>
        </div>
      </div>

      {/* Timeout explanation - plain language (NFR-3.2) */}
      <div className="flex gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <p className="text-xs text-yellow-200/80 font-sans leading-relaxed">
          If the seller delivers and you don't confirm in time, funds automatically release to the seller after the timeout window.
        </p>
      </div>

      {/* Confirmation checkbox - US-008 AC: must explicitly check before Lock Funds activates */}
      <label className="flex cursor-pointer items-start gap-3 group">
        <div className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="sr-only peer"
          />
          <div className={cn(
            'h-5 w-5 rounded border-2 transition-all',
            confirmed ? 'border-primary bg-primary/20' : 'border-border bg-muted/40 group-hover:border-primary/40',
          )}>
            {confirmed && (
              <svg viewBox="0 0 16 16" className="p-0.5 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="3,8 7,12 13,4" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-sans leading-relaxed">
          I have read and agree to the deal terms. I understand my funds will be held in a smart contract until I confirm receipt or the timeout expires.
        </span>
      </label>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleFund}
        disabled={!confirmed || loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'bg-primary text-primary-foreground glow-teal',
          'hover:bg-primary/90',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Locking Funds...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Lock {formatXlm(deal.amount)} XLM
          </>
        )}
      </button>
    </div>
  )
}
