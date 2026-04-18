import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 group-hover:glow-teal-sm transition-all">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <span className="font-display text-base tracking-tight text-foreground">
            Swap<span className="text-primary">Proof</span>
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/create"
            className="hidden sm:flex items-center gap-1.5 text-sm font-display text-muted-foreground hover:text-foreground transition-colors"
          >
            Create Deal
          </Link>
          <ConnectWalletButton compact />
        </div>
      </nav>
    </header>
  )
}
