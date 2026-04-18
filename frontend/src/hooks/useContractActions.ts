import { useState } from 'react'
import {
  buildClaimRefund,
  buildClaimSellerTimeout,
  buildConfirmReceipt,
  buildFundDeal,
  buildMarkShipped,
} from '@/lib/soroban/contract'
import { useFreighter } from './useFreighter'

function useSignedAction<TAction extends (dealId: bigint) => Promise<string>>(
  buildLabel: string,
  actionFactory: (address: string, signAndSubmit: (xdr: string) => Promise<string>) => TAction,
) {
  const { address, signAndSubmit } = useFreighter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const action = actionFactory(address ?? '', signAndSubmit)

  const wrappedAction = async (dealId: bigint): Promise<string> => {
    if (!address) throw new Error('Wallet not connected.')
    setLoading(true)
    setError(null)

    try {
      return await action(dealId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : buildLabel
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { action: wrappedAction, loading, error }
}

export function useFundDeal() {
  const { action, loading, error } = useSignedAction(
    'Failed to lock funds.',
    (address, signAndSubmit) => async (dealId) => {
      const xdr = await buildFundDeal({ dealId, buyer: address })
      return signAndSubmit(xdr)
    },
  )

  return { fundDeal: action, loading, error }
}

export function useMarkShipped() {
  const { action, loading, error } = useSignedAction(
    'Failed to mark shipment.',
    (address, signAndSubmit) => async (dealId) => {
      const xdr = await buildMarkShipped({ dealId, seller: address })
      return signAndSubmit(xdr)
    },
  )

  return { markShipped: action, loading, error }
}

export function useConfirmReceipt() {
  const { action, loading, error } = useSignedAction(
    'Failed to confirm receipt.',
    (address, signAndSubmit) => async (dealId) => {
      const xdr = await buildConfirmReceipt({ dealId, buyer: address })
      return signAndSubmit(xdr)
    },
  )

  return { confirmReceipt: action, loading, error }
}

export function useClaimRefund() {
  const { action, loading, error } = useSignedAction(
    'Failed to claim refund.',
    (address, signAndSubmit) => async (dealId) => {
      const xdr = await buildClaimRefund({ dealId, buyer: address })
      return signAndSubmit(xdr)
    },
  )

  return { claimRefund: action, loading, error }
}

export function useClaimSellerTimeout() {
  const { action, loading, error } = useSignedAction(
    'Failed to claim payment.',
    (address, signAndSubmit) => async (dealId) => {
      const xdr = await buildClaimSellerTimeout({ dealId, seller: address })
      return signAndSubmit(xdr)
    },
  )

  return { claimSellerTimeout: action, loading, error }
}
