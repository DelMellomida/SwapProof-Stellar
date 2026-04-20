import { AlertCircle, Bot, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { getStellarExpertAccountUrl } from '@/lib/utils'
import type { SellerCredibilityData } from '@/hooks/useAiSellerCredibility'

interface BuyerSellerCredibilityCardProps {
  loading: boolean
  data: SellerCredibilityData | null
  sellerAddress: string
  onRetry: () => void
}

function tierClasses(tier: SellerCredibilityData['tier']): string {
  if (tier === 'higher') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }
  if (tier === 'moderate') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  }
  return 'border-red-500/30 bg-red-500/10 text-red-200'
}

export function BuyerSellerCredibilityCard({
  loading,
  data,
  sellerAddress,
  onRetry,
}: BuyerSellerCredibilityCardProps) {
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-display text-indigo-300 uppercase tracking-[0.2em]">
            Seller Credibility Snapshot
          </p>
          <p className="text-sm text-muted-foreground font-sans">
            Grounded in on-chain and wallet activity signals. Not identity verification.
          </p>
        </div>
        <ShieldCheck className="h-4 w-4 text-indigo-300 shrink-0 mt-0.5" />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-foreground font-sans">
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-300" />
          Calculating seller credibility signals...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-display tracking-wide ${tierClasses(data.tier)}`}
            >
              {data.tierLabel}
            </span>
            <a
              href={getStellarExpertAccountUrl(sellerAddress)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-200 hover:text-indigo-100 transition-colors"
            >
              View Wallet <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-xl border border-indigo-400/20 bg-background/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-200/80 font-display">
              <Bot className="h-3.5 w-3.5" />
              Buyer Guidance
            </div>
            <p className="text-sm text-foreground leading-relaxed font-sans">{data.summary}</p>
            {data.usingFallbackSummary && (
              <p className="text-xs text-muted-foreground font-sans">
                AI summary unavailable. Showing deterministic guidance from computed signals.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-display">
              Why this tier
            </p>
            <ul className="space-y-1 text-sm text-foreground font-sans">
              {data.reasons.slice(0, 4).map((reason) => (
                <li key={reason} className="text-sm text-muted-foreground">
                  • {reason}
                </li>
              ))}
            </ul>
          </div>

          {data.error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 font-sans flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{data.error}</span>
            </div>
          )}
        </>
      )}

      {!loading && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 text-sm text-indigo-200 hover:text-indigo-100 transition-colors"
          type="button"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Credibility Signals
        </button>
      )}
    </div>
  )
}
