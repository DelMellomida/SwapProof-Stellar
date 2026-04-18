import { Loader2, Wallet, LogOut } from 'lucide-react'
import { useFreighter } from '@/hooks/useFreighter'
import { formatAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ConnectWalletButtonProps {
  className?: string
  compact?: boolean
}

export function ConnectWalletButton({ className, compact = false }: ConnectWalletButtonProps) {
  const { address, isConnecting, isConnected, connect, disconnect } = useFreighter()

  if (isConnected && address) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className={cn(
          'rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5',
          'font-display text-xs text-primary',
        )}>
          {formatAddress(address)}
        </span>
        {!compact && (
          <button
            onClick={disconnect}
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Disconnect wallet"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-primary/40',
        'px-4 py-2 font-display text-sm text-primary',
        'hover:bg-primary/10 hover:border-primary/60 transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </>
      )}
    </button>
  )
}
