import { NETWORK } from '@/lib/soroban/client'

const HORIZON_BASE_URL =
  NETWORK === 'mainnet'
    ? import.meta.env.VITE_HORIZON_URL_MAINNET ?? 'https://horizon.stellar.org'
    : import.meta.env.VITE_HORIZON_URL_TESTNET ?? 'https://horizon-testnet.stellar.org'

const REQUEST_TIMEOUT_MS = 8_000
const RECENT_WINDOW_DAYS = 30

interface HorizonAccountResponse {
  id: string
  created_at?: string
}

interface HorizonOperationsResponse {
  _embedded?: {
    records?: Array<{
      type: string
      created_at?: string
    }>
  }
}

export interface SellerWalletHistoryMetrics {
  accountExists: boolean
  accountAgeDays: number | null
  recentOperations30d: number | null
  recentPayments30d: number | null
  latestOperationAt: string | null
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function toDaysSince(dateIso: string): number {
  const createdAtMs = Date.parse(dateIso)
  const nowMs = Date.now()

  if (Number.isNaN(createdAtMs)) {
    return 0
  }

  return Math.max(0, Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24)))
}

export async function getSellerWalletHistoryMetrics(
  sellerAddress: string,
): Promise<SellerWalletHistoryMetrics> {
  const accountUrl = `${HORIZON_BASE_URL}/accounts/${sellerAddress}`
  const operationsUrl = `${HORIZON_BASE_URL}/accounts/${sellerAddress}/operations?order=desc&limit=60`

  const accountResponse = await fetchWithTimeout(accountUrl)

  if (accountResponse.status === 404) {
    return {
      accountExists: false,
      accountAgeDays: null,
      recentOperations30d: null,
      recentPayments30d: null,
      latestOperationAt: null,
    }
  }

  if (!accountResponse.ok) {
    throw new Error('Could not fetch seller account history from Horizon')
  }

  const account = (await accountResponse.json()) as HorizonAccountResponse

  let operationsData: HorizonOperationsResponse | null = null

  try {
    const operationsResponse = await fetchWithTimeout(operationsUrl)
    if (operationsResponse.ok) {
      operationsData = (await operationsResponse.json()) as HorizonOperationsResponse
    }
  } catch {
    operationsData = null
  }

  const records = operationsData?._embedded?.records ?? []
  const cutoffMs = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const recentRecords = records.filter((record) => {
    if (!record.created_at) return false
    const recordMs = Date.parse(record.created_at)
    return !Number.isNaN(recordMs) && recordMs >= cutoffMs
  })

  const recentPayments = recentRecords.filter((record) => {
    return (
      record.type === 'payment' ||
      record.type === 'path_payment_strict_send' ||
      record.type === 'path_payment_strict_receive'
    )
  }).length

  return {
    accountExists: true,
    accountAgeDays: account.created_at ? toDaysSince(account.created_at) : null,
    recentOperations30d: records.length ? recentRecords.length : null,
    recentPayments30d: records.length ? recentPayments : null,
    latestOperationAt: records[0]?.created_at ?? null,
  }
}
