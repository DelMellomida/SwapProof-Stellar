import { useState } from 'react'
import {
  buildFundDeal,
  buildConfirmReceipt,
  buildClaimTimeout,
} from '@/lib/soroban/contract'
import { useFreighter } from './useFreighter'

// ─── useFundDeal ──────────────────────────────────────────────────────────────
// US-002 — Buyer locks funds into escrow

export function useFundDeal() {
  const { address, signAndSubmit } = useFreighter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fundDeal = async (dealId: bigint): Promise<string> => {
    if (!address) throw new Error('Wallet not connected.')
    setLoading(true)
    setError(null)
    try {
      const xdr = await buildFundDeal({ dealId, buyer: address })
      const txHash = await signAndSubmit(xdr)
      return txHash
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to lock funds.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { fundDeal, loading, error }
}

// ─── useConfirmReceipt ────────────────────────────────────────────────────────
// US-003 — Buyer confirms receipt, releases funds to seller

export function useConfirmReceipt() {
  const { address, signAndSubmit } = useFreighter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmReceipt = async (dealId: bigint): Promise<string> => {
    if (!address) throw new Error('Wallet not connected.')
    setLoading(true)
    setError(null)
    try {
      const xdr = await buildConfirmReceipt({ dealId, buyer: address })
      const txHash = await signAndSubmit(xdr)
      return txHash
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm receipt.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { confirmReceipt, loading, error }
}

// ─── useClaimTimeout ──────────────────────────────────────────────────────────
// US-004 — Seller reclaims funds after timeout

export function useClaimTimeout() {
  const { address, signAndSubmit } = useFreighter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claimTimeout = async (dealId: bigint): Promise<string> => {
    if (!address) throw new Error('Wallet not connected.')
    setLoading(true)
    setError(null)
    try {
      const xdr = await buildClaimTimeout({ dealId, seller: address })
      const txHash = await signAndSubmit(xdr)
      return txHash
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to claim payment.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { claimTimeout, loading, error }
}
