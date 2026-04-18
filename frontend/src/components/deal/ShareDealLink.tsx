import { useState } from 'react'
import { Copy, Check, Link } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ShareDealLinkProps {
  dealId: bigint
  className?: string
}

export function ShareDealLink({ dealId, className }: ShareDealLinkProps) {
  const [copied, setCopied] = useState(false)

  const dealUrl = `${window.location.origin}/deal/${dealId.toString()}`

  const handleCopy = async () => {
    await copyToClipboard(dealUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">
        Share this link with your buyer
      </p>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-display text-sm text-foreground/80">
          {dealUrl}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-display transition-all',
            copied
              ? 'bg-green-500/20 text-green-400'
              : 'bg-primary/10 text-primary hover:bg-primary/20',
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  )
}
