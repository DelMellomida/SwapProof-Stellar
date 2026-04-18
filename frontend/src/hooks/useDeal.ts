import { useState, useEffect, useCallback } from 'react'
import { getDeal } from '@/lib/soroban/contract'
import type { Deal } from '@/lib/soroban/types'

interface UseDealResult {
  deal: Deal | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches deal state live from the Soroban contract — never from a DB cache.
 * Satisfies FR-2.4 and NFR-4.2.
 */
export function useDeal(dealId: string | undefined): UseDealResult {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (silent = false) => {
    if (!dealId) return
    if (!silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await getDeal(BigInt(dealId))
      setDeal(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load deal. Please check the link and try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return {
    deal,
    loading,
    error,
    refetch: () => {
      void fetch(true)
    },
  }
}
