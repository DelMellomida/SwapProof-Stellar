import { ShieldCheck } from 'lucide-react'
import { CreateDealForm } from '@/components/deal/CreateDealForm'
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton'
import { useFreighter } from '@/hooks/useFreighter'

export function CreateDealPage() {
  const { isConnected } = useFreighter()

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl text-foreground">Create a Deal</h1>
        </div>
        <p className="text-sm text-muted-foreground font-sans">
          Set up escrow before asking your buyer to pay. The deal will be recorded on-chain immediately.
        </p>
      </div>

      {/* Wallet gate — seller must be connected to sign create_deal() */}
      {!isConnected ? (
        <div className="card-glass p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground font-sans">
            Connect your wallet to create a deal. Your wallet address becomes the seller on-chain.
          </p>
          <ConnectWalletButton />
        </div>
      ) : (
        <div className="card-glass p-6">
          <CreateDealForm />
        </div>
      )}
    </div>
  )
}
