import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useCreateDeal } from '@/hooks/useCreateDeal'
import { cn } from '@/lib/utils'
import type { CreateDealFormValues } from '@/lib/soroban/types'

const TIMEOUT_OPTIONS = [1, 2, 3, 5, 7, 14]

export function CreateDealForm() {
  const navigate = useNavigate()
  const { createDeal, loading, error } = useCreateDeal()

  const [values, setValues] = useState<CreateDealFormValues>({
    itemName: '',
    amountXlm: 0,
    timeoutDays: 3,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { dealId } = await createDeal(values)
      navigate(`/deal/${dealId.toString()}?created=1`)
    } catch {
      // error state handled in hook
    }
  }

  const isValid =
    values.itemName.trim().length >= 3 && values.amountXlm > 0 && values.timeoutDays > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Item Name */}
      <div className="space-y-2">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Item Name
        </label>
        <input
          type="text"
          placeholder="e.g. iPhone 14 Pro Max 256GB"
          value={values.itemName}
          onChange={(e) => setValues((v) => ({ ...v, itemName: e.target.value }))}
          maxLength={80}
          required
          className={cn(
            'w-full rounded-lg border border-border bg-muted/40 px-4 py-3',
            'font-sans text-sm text-foreground placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'transition-all',
          )}
        />
        <p className="text-xs text-muted-foreground text-right">
          {values.itemName.length}/80
        </p>
      </div>

      {/* Price */}
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

      {/* Timeout */}
      <div className="space-y-3">
        <label className="block text-xs font-display tracking-widest text-muted-foreground uppercase">
          Delivery Timeout
        </label>
        <p className="text-xs text-muted-foreground font-sans">
          If the buyer doesn't confirm delivery within this window, you can claim your payment back.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TIMEOUT_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setValues((v) => ({ ...v, timeoutDays: days }))}
              className={cn(
                'rounded-lg border py-2 text-sm font-display transition-all',
                values.timeoutDays === days
                  ? 'border-primary/60 bg-primary/10 text-primary glow-teal-sm'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30',
              )}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Submit */}
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
        Your deal will be recorded on the Stellar blockchain — no middleman, no custody risk.
      </p>
    </form>
  )
}
