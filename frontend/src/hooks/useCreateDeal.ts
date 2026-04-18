import { useState } from 'react'
import { buildCreateDeal, getCurrentLedger, LEDGERS_PER_DAY, xlmToStroops } from '@/lib/soroban/contract'
import { generateDealId } from '@/lib/utils'
import { useFreighter } from './useFreighter'
import type { CreateDealFormValues } from '@/lib/soroban/types'

interface UseCreateDealResult {
  createDeal: (values: CreateDealFormValues) => Promise<{ dealId: bigint; txHash: string }>
  loading: boolean
  error: string | null
}

export function useCreateDeal(): UseCreateDealResult {
  const { address, signAndSubmit } = useFreighter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createDeal = async (values: CreateDealFormValues) => {
    if (!address) throw new Error('Wallet not connected.')
    setLoading(true)
    setError(null)

    try {
      const dealId = generateDealId()
      const currentLedger = await getCurrentLedger()
      const timeoutLedger = currentLedger + values.timeoutDays * LEDGERS_PER_DAY

      const unsignedXdr = await buildCreateDeal({
        dealId,
        seller: address,
        amountStroops: xlmToStroops(values.amountXlm),
        timeoutLedger,
        itemName: values.itemName,
      })

      const txHash = await signAndSubmit(unsignedXdr)
      return { dealId, txHash }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create deal.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createDeal, loading, error }
}
