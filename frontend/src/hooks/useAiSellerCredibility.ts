import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  generateSellerCredibilitySummary,
  isGeminiConfigured,
  type SellerCredibilitySummaryInput,
} from '@/lib/ai/gemini'
import { getSellerWalletHistoryMetrics, type SellerWalletHistoryMetrics } from '@/lib/stellar/horizon'
import type { DealStatus } from '@/lib/soroban/types'

export type CredibilityTier = 'higher' | 'moderate' | 'low'

export interface SellerCredibilityData {
  tier: CredibilityTier
  tierLabel: string
  reasons: string[]
  summary: string
  metrics: SellerWalletHistoryMetrics | null
  usingFallbackSummary: boolean
  error: string | null
}

interface UseAiSellerCredibilityParams {
  enabled: boolean
  dealId: string | null
  sellerAddress: string | null
  dealStatus: DealStatus | null
  itemName: string | null
  escrowAmountXlm: string | null
  shippingUrgency: string
  buyerReviewUrgency: string
}

interface UseAiSellerCredibilityResult {
  data: SellerCredibilityData | null
  loading: boolean
  retry: () => void
}

const CREDIBILITY_CACHE_PREFIX = 'seller-credibility:'
const CREDIBILITY_CACHE_TTL_MS = 10 * 60 * 1000

interface SellerCredibilityCacheEntry {
  savedAt: number
  data: SellerCredibilityData
}

function readCachedCredibility(contextKey: string): SellerCredibilityData | null {
  try {
    const raw = window.sessionStorage.getItem(`${CREDIBILITY_CACHE_PREFIX}${contextKey}`)
    if (!raw) return null

    const parsed = JSON.parse(raw) as SellerCredibilityCacheEntry
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      return null
    }

    if (Date.now() - parsed.savedAt > CREDIBILITY_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(`${CREDIBILITY_CACHE_PREFIX}${contextKey}`)
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}

function writeCachedCredibility(contextKey: string, data: SellerCredibilityData): void {
  try {
    const payload: SellerCredibilityCacheEntry = {
      savedAt: Date.now(),
      data,
    }
    window.sessionStorage.setItem(`${CREDIBILITY_CACHE_PREFIX}${contextKey}`, JSON.stringify(payload))
  } catch {
    // Cache write failures should never block credibility rendering.
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function scoreToTier(score: number): { tier: CredibilityTier; tierLabel: string } {
  if (score >= 70) {
    return { tier: 'higher', tierLabel: 'Higher confidence' }
  }
  if (score >= 45) {
    return { tier: 'moderate', tierLabel: 'Moderate confidence' }
  }
  return { tier: 'low', tierLabel: 'Low confidence' }
}

function buildDeterministicSignals(params: {
  metrics: SellerWalletHistoryMetrics | null
  dealStatus: DealStatus
  shippingUrgency: string
  buyerReviewUrgency: string
}): { score: number; reasons: string[] } {
  const { metrics, dealStatus, shippingUrgency, buyerReviewUrgency } = params

  let score = 50
  const reasons: string[] = []

  if (!metrics || !metrics.accountExists) {
    score -= 28
    reasons.push('Seller wallet history could not be fully verified from Horizon right now.')
  } else {
    reasons.push('Seller wallet is visible on-chain and independently verifiable.')

    if (metrics.accountAgeDays !== null) {
      if (metrics.accountAgeDays >= 180) {
        score += 16
        reasons.push('Wallet appears established (older than 6 months).')
      } else if (metrics.accountAgeDays >= 30) {
        score += 8
        reasons.push('Wallet is at least 1 month old.')
      } else {
        score -= 8
        reasons.push('Wallet appears relatively new, so historical signal depth is limited.')
      }
    }

    if (metrics.recentOperations30d !== null) {
      if (metrics.recentOperations30d >= 40) {
        score += 12
        reasons.push('Wallet shows consistent activity in the last 30 days.')
      } else if (metrics.recentOperations30d >= 10) {
        score += 6
        reasons.push('Wallet has moderate recent activity in the last 30 days.')
      } else if (metrics.recentOperations30d === 0) {
        score -= 10
        reasons.push('Wallet shows little or no recent activity in the last 30 days.')
      }
    }

    if (metrics.recentPayments30d !== null && metrics.recentPayments30d === 0) {
      score -= 5
      reasons.push('No recent payment-like operations were detected in the last 30 days.')
    }
  }

  if (dealStatus === 'ShippedAwaitingReceipt') {
    score += 8
    reasons.push('Seller already marked shipment on-chain for this active deal.')
    reasons.push(`Buyer review urgency: ${buyerReviewUrgency}`)
  }

  if (dealStatus === 'FundedAwaitingShipment') {
    score -= 3
    reasons.push('Seller still needs to mark shipment for this funded deal.')
    reasons.push(`Shipping urgency: ${shippingUrgency}`)
  }

  if (dealStatus === 'PendingPayment') {
    score -= 2
    reasons.push('This deal is not funded yet, so there is no buyer lock signal on-chain.')
    reasons.push(`Shipping urgency once funded: ${shippingUrgency}`)
  }

  return {
    score: clampScore(score),
    reasons,
  }
}

function buildFallbackSummary(tierLabel: string, reasons: string[]): string {
  const topReasons = reasons.slice(0, 3)
  return `${tierLabel}. ${topReasons.join(' ')}`
}

export function useAiSellerCredibility({
  enabled,
  dealId,
  sellerAddress,
  dealStatus,
  itemName,
  escrowAmountXlm,
  shippingUrgency,
  buyerReviewUrgency,
}: UseAiSellerCredibilityParams): UseAiSellerCredibilityResult {
  const [data, setData] = useState<SellerCredibilityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestNonce, setRequestNonce] = useState(0)
  const lastGeneratedContextKeyRef = useRef<string | null>(null)
  const lastHandledRequestNonceRef = useRef<number>(-1)

  const retry = useCallback(() => {
    setRequestNonce((prev) => prev + 1)
  }, [])

  const aiInput = useMemo<SellerCredibilitySummaryInput | null>(() => {
    if (!sellerAddress || !dealStatus || !itemName || !escrowAmountXlm) {
      return null
    }

    if (
      dealStatus !== 'PendingPayment' &&
      dealStatus !== 'FundedAwaitingShipment' &&
      dealStatus !== 'ShippedAwaitingReceipt'
    ) {
      return null
    }

    return {
      sellerAddress,
      dealStatus,
      itemName,
      escrowAmountXlm,
      shippingUrgency,
      buyerReviewUrgency,
      tierLabel: 'Moderate confidence',
      reasons: [],
    }
  }, [
    sellerAddress,
    dealStatus,
    itemName,
    escrowAmountXlm,
    shippingUrgency,
    buyerReviewUrgency,
  ])

  const generationContextKey = useMemo(() => {
    if (!aiInput || !dealId) {
      return null
    }

    // Keep analysis sticky for the same deal across status transitions.
    return `deal:${dealId}`
  }, [aiInput, dealId])

  useEffect(() => {
    if (!enabled || !aiInput || !generationContextKey) {
      setData(null)
      setLoading(false)
      return
    }

    const alreadyGeneratedForContext = lastGeneratedContextKeyRef.current === generationContextKey
    const alreadyHandledCurrentNonce = lastHandledRequestNonceRef.current === requestNonce

    if (alreadyGeneratedForContext && alreadyHandledCurrentNonce) {
      return
    }

    if (!alreadyGeneratedForContext && requestNonce === 0) {
      const cached = readCachedCredibility(generationContextKey)
      if (cached) {
        lastGeneratedContextKeyRef.current = generationContextKey
        lastHandledRequestNonceRef.current = requestNonce
        setData(cached)
        setLoading(false)
        return
      }
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)

      try {
        let metrics: SellerWalletHistoryMetrics | null = null

        try {
          metrics = await getSellerWalletHistoryMetrics(aiInput.sellerAddress)
        } catch {
          metrics = null
        }

        const { score, reasons } = buildDeterministicSignals({
          metrics,
          dealStatus: aiInput.dealStatus,
          shippingUrgency: aiInput.shippingUrgency,
          buyerReviewUrgency: aiInput.buyerReviewUrgency,
        })

        const { tier, tierLabel } = scoreToTier(score)

        const groundedInput: SellerCredibilitySummaryInput = {
          ...aiInput,
          tierLabel,
          reasons,
        }

        let summary = buildFallbackSummary(tierLabel, reasons)
        let usingFallbackSummary = true
        let error: string | null = null

        if (isGeminiConfigured()) {
          try {
            summary = await generateSellerCredibilitySummary(groundedInput)
            usingFallbackSummary = false
          } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to generate credibility summary'
          }
        }

        if (cancelled) return

        lastGeneratedContextKeyRef.current = generationContextKey
        lastHandledRequestNonceRef.current = requestNonce

        setData({
          tier,
          tierLabel,
          reasons,
          summary,
          metrics,
          usingFallbackSummary,
          error,
        })

        writeCachedCredibility(generationContextKey, {
          tier,
          tierLabel,
          reasons,
          summary,
          metrics,
          usingFallbackSummary,
          error,
        })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [enabled, aiInput, generationContextKey, requestNonce])

  return {
    data,
    loading,
    retry,
  }
}
