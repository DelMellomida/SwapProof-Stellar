import { useState } from 'react'
import { buildCreateDeal, getCurrentLedger, LEDGERS_PER_DAY, xlmToStroops } from '@/lib/soroban/contract'
import { ESCROW_ASSET_CONTRACT_ID } from '@/lib/soroban/client'
import { generateDealId } from '@/lib/utils'
import { useFreighter } from './useFreighter'
import {
  BUYER_REVIEW_MAX_DAYS,
  BUYER_REVIEW_MIN_DAYS,
  SHIP_WINDOW_MAX_DAYS,
  SHIP_WINDOW_MIN_DAYS,
  type CreateDealFormValues,
} from '@/lib/soroban/types'

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

    if (!Number.isInteger(values.shipWindowDays)) {
      throw new Error('Shipping window must be a whole number of days.')
    }

    if (values.shipWindowDays < SHIP_WINDOW_MIN_DAYS || values.shipWindowDays > SHIP_WINDOW_MAX_DAYS) {
      throw new Error(`Shipping window must be between ${SHIP_WINDOW_MIN_DAYS} and ${SHIP_WINDOW_MAX_DAYS} days.`)
    }

    if (!Number.isInteger(values.buyerConfirmDays)) {
      throw new Error('Buyer review window must be a whole number of days.')
    }

    if (values.buyerConfirmDays < BUYER_REVIEW_MIN_DAYS || values.buyerConfirmDays > BUYER_REVIEW_MAX_DAYS) {
      throw new Error(`Buyer review window must be between ${BUYER_REVIEW_MIN_DAYS} and ${BUYER_REVIEW_MAX_DAYS} days.`)
    }

    setLoading(true)
    setError(null)

    try {
      const dealId = generateDealId()
      const currentLedger = await getCurrentLedger()
      const shipDeadlineLedger = currentLedger + values.shipWindowDays * LEDGERS_PER_DAY
      const buyerConfirmWindowLedgers = values.buyerConfirmDays * LEDGERS_PER_DAY

      const unsignedXdr = await buildCreateDeal({
        dealId,
        seller: address,
        escrowToken: ESCROW_ASSET_CONTRACT_ID,
        amountStroops: xlmToStroops(values.amountXlm),
        shipDeadlineLedger,
        buyerConfirmWindowLedgers,
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
