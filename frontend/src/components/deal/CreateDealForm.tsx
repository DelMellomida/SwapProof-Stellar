import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck, Sparkles, Check, X } from 'lucide-react'
import { useCreateDeal } from '@/hooks/useCreateDeal'
import { useAiOptimizeTitle } from '@/hooks/useAiOptimizeTitle'
import { cn } from '@/lib/utils'
import {
  BUYER_REVIEW_MAX_DAYS,
  BUYER_REVIEW_MIN_DAYS,
  SHIP_WINDOW_MAX_DAYS,
  SHIP_WINDOW_MIN_DAYS,
  type CreateDealFormValues,
} from '@/lib/soroban/types'

const SHIP_WINDOW_PRESETS = [1, 2, 3, 5, 7, 14]
const BUYER_CONFIRM_PRESETS = [1, 2, 3, 5, 7]

type WindowMode = 'preset' | 'custom'

export function CreateDealForm() {
  const navigate = useNavigate()
  const { createDeal, loading, error } = useCreateDeal()
  const { suggestion, loading: aiLoading, error: aiError, optimizeTitle, clearSuggestion } = useAiOptimizeTitle()

  const [values, setValues] = useState<CreateDealFormValues>({
    itemName: '',
    amountXlm: 0,
    shipWindowDays: 3,
    buyerConfirmDays: 2,
  })
  const [shipWindowMode, setShipWindowMode] = useState<WindowMode>('preset')
  const [buyerReviewMode, setBuyerReviewMode] = useState<WindowMode>('preset')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { dealId } = await createDeal(values)
      navigate(`/deal/${dealId.toString()}?created=1`)
    } catch {
      // error state handled in hook
    }
  }

  const shipWindowValid =
    Number.isInteger(values.shipWindowDays) &&
    values.shipWindowDays >= SHIP_WINDOW_MIN_DAYS &&
    values.shipWindowDays <= SHIP_WINDOW_MAX_DAYS

  const buyerReviewValid =
    Number.isInteger(values.buyerConfirmDays) &&
    values.buyerConfirmDays >= BUYER_REVIEW_MIN_DAYS &&
    values.buyerConfirmDays <= BUYER_REVIEW_MAX_DAYS

  const isValid =
    values.itemName.trim().length >= 3 &&
    values.amountXlm > 0 &&
    shipWindowValid &&
    buyerReviewValid

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Item Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. iPhone 14 Pro Max 256GB"
            value={values.itemName}
            onChange={(e) => setValues((v) => ({ ...v, itemName: e.target.value }))}
            maxLength={80}
            required
            className={cn(
              'flex-1 rounded-lg border border-border bg-muted/40 px-4 py-3',
              'font-sans text-sm text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              'transition-all',
            )}
          />
          <button
            type="button"
            onClick={() => optimizeTitle(values.itemName)}
            disabled={values.itemName.trim().length < 3 || aiLoading}
            className={cn(
              'rounded-lg px-4 py-3 font-display text-sm transition-all',
              'border border-primary/30 bg-primary/10 text-primary',
              'hover:bg-primary/20 hover:border-primary/50',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10',
              'flex items-center gap-2 whitespace-nowrap',
            )}
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Optimizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Optimize</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {values.itemName.length}/80
        </p>

        {/* AI Suggestion Display */}
        {suggestion && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-display text-primary uppercase tracking-widest">
              ✨ AI Suggestion
            </p>
            <p className="text-sm text-foreground">{suggestion}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setValues((v) => ({ ...v, itemName: suggestion.slice(0, 80) }))
                  clearSuggestion()
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded border border-primary/40',
                  'bg-primary/10 py-2 text-xs font-display text-primary',
                  'hover:bg-primary/20 transition-all',
                )}
              >
                <Check className="h-3.5 w-3.5" />
                Use This
              </button>
              <button
                type="button"
                onClick={clearSuggestion}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded border border-muted/40',
                  'bg-muted/10 py-2 text-xs font-display text-muted-foreground',
                  'hover:bg-muted/20 transition-all',
                )}
              >
                <X className="h-3.5 w-3.5" />
                Skip
              </button>
            </div>
          </div>
        )}

        {/* AI Error Display */}
        {aiError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {aiError}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Price (XLM)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-muted-foreground text-sm">
            XLM
          </span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            placeholder="0.00"
            value={values.amountXlm === 0 ? '' : values.amountXlm}
            onChange={(e) =>
              setValues((v) => ({ ...v, amountXlm: parseFloat(e.target.value) || 0 }))
            }
            required
            className={cn(
              'w-full rounded-lg border border-border bg-muted/40 py-3 pl-16 pr-4',
              'font-display text-xl text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              'transition-all',
            )}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Seller Shipping Window
        </label>
        <p className="text-xs text-muted-foreground font-sans">
          The seller must mark the item as shipped within this window after the buyer funds the deal.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {SHIP_WINDOW_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setShipWindowMode('preset')
                setValues((v) => ({ ...v, shipWindowDays: days }))
              }}
              className={cn(
                'rounded-lg border py-2 text-sm font-display transition-all',
                shipWindowMode === 'preset' && values.shipWindowDays === days
                  ? 'border-primary/60 bg-primary/10 text-primary glow-teal-sm'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
              )}
            >
              {days}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShipWindowMode('custom')}
            className={cn(
              'rounded-lg border py-2 text-sm font-display transition-all',
              shipWindowMode === 'custom'
                ? 'border-primary/60 bg-primary/10 text-primary glow-teal-sm'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
            )}
          >
            Custom
          </button>
        </div>

        {shipWindowMode === 'custom' && (
          <div className="space-y-2">
            <input
              type="number"
              min={SHIP_WINDOW_MIN_DAYS}
              max={SHIP_WINDOW_MAX_DAYS}
              step={1}
              value={values.shipWindowDays || ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, shipWindowDays: Number.parseInt(e.target.value, 10) || 0 }))
              }
              className={cn(
                'w-full rounded-lg border border-border bg-muted/40 px-4 py-3',
                'font-sans text-sm text-foreground placeholder:text-muted-foreground/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all',
              )}
              placeholder={`Enter ${SHIP_WINDOW_MIN_DAYS}-${SHIP_WINDOW_MAX_DAYS} days`}
            />
            <p className="text-xs text-muted-foreground font-sans">
              Set any whole number from {SHIP_WINDOW_MIN_DAYS} to {SHIP_WINDOW_MAX_DAYS} days.
            </p>
            {!shipWindowValid && (
              <p className="text-xs text-destructive font-sans">
                Shipping window must be a whole number between {SHIP_WINDOW_MIN_DAYS} and {SHIP_WINDOW_MAX_DAYS}.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Buyer Review Window
        </label>
        <p className="text-xs text-muted-foreground font-sans">
          After the seller marks shipped, the buyer has this many days to confirm receipt before the seller can claim.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BUYER_CONFIRM_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setBuyerReviewMode('preset')
                setValues((v) => ({ ...v, buyerConfirmDays: days }))
              }}
              className={cn(
                'rounded-lg border py-2 text-sm font-display transition-all',
                buyerReviewMode === 'preset' && values.buyerConfirmDays === days
                  ? 'border-primary/60 bg-primary/10 text-primary glow-teal-sm'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
              )}
            >
              {days}d
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBuyerReviewMode('custom')}
            className={cn(
              'rounded-lg border py-2 text-sm font-display transition-all',
              buyerReviewMode === 'custom'
                ? 'border-primary/60 bg-primary/10 text-primary glow-teal-sm'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
            )}
          >
            Custom
          </button>
        </div>

        {buyerReviewMode === 'custom' && (
          <div className="space-y-2">
            <input
              type="number"
              min={BUYER_REVIEW_MIN_DAYS}
              max={BUYER_REVIEW_MAX_DAYS}
              step={1}
              value={values.buyerConfirmDays || ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, buyerConfirmDays: Number.parseInt(e.target.value, 10) || 0 }))
              }
              className={cn(
                'w-full rounded-lg border border-border bg-muted/40 px-4 py-3',
                'font-sans text-sm text-foreground placeholder:text-muted-foreground/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all',
              )}
              placeholder={`Enter ${BUYER_REVIEW_MIN_DAYS}-${BUYER_REVIEW_MAX_DAYS} days`}
            />
            <p className="text-xs text-muted-foreground font-sans">
              Set any whole number from {BUYER_REVIEW_MIN_DAYS} to {BUYER_REVIEW_MAX_DAYS} days.
            </p>
            {!buyerReviewValid && (
              <p className="text-xs text-destructive font-sans">
                Buyer review window must be a whole number between {BUYER_REVIEW_MIN_DAYS} and {BUYER_REVIEW_MAX_DAYS}.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || loading}
        className={cn(
          'w-full rounded-lg py-3.5 font-display text-sm tracking-wide transition-all',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 glow-teal',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:glow-none',
          'flex items-center justify-center gap-2',
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating Deal...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Create Secure Deal
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground font-sans">
        The deal will record both the shipping window and the buyer review window on-chain.
      </p>
    </form>
  )
}
