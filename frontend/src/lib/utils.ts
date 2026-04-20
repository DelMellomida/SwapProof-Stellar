import { formatDistanceToNow, format } from 'date-fns'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { LEDGERS_PER_DAY, LEDGERS_PER_SECOND } from '@/lib/soroban/contract'
import { NETWORK } from '@/lib/soroban/client'

// ─── shadcn/ui cn helper ──────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Address formatting ───────────────────────────────────────────────────────

/**
 * Shorten a Stellar address to "GABCD...XYZW" format. (FR-2.5)
 */
export function formatAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-4)}`
}

// ─── XLM formatting ──────────────────────────────────────────────────────────

/**
 * Format a stroops bigint as a human-readable XLM string. (FR-2.5)
 */
export function formatXlm(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(xlm)
}

// ─── Ledger → time helpers ────────────────────────────────────────────────────

/**
 * Estimate a JS Date from a timeout ledger sequence and the current ledger.
 * Used to show human-readable countdown. (FR-2.6)
 */
export function ledgerToDate(timeoutLedger: number, currentLedger: number): Date {
  const ledgersRemaining = timeoutLedger - currentLedger
  const secondsRemaining = ledgersRemaining / LEDGERS_PER_SECOND
  return new Date(Date.now() + secondsRemaining * 1000)
}

/**
 * Returns a string like "4 days, 6 hours remaining" or "Expired". (FR-2.6 / NFR-3.2)
 */
export function formatTimeout(timeoutLedger: number, currentLedger: number): string {
  if (currentLedger >= timeoutLedger) return 'Expired'
  const targetDate = ledgerToDate(timeoutLedger, currentLedger)
  return `${formatDistanceToNow(targetDate)} remaining`
}

/**
 * Returns true if the timeout has passed on-chain.
 */
export function isTimeoutPassed(timeoutLedger: number, currentLedger: number): boolean {
  return currentLedger > timeoutLedger
}

// ─── Deal ID generation ───────────────────────────────────────────────────────

/**
 * Generate a reasonably unique deal ID (timestamp-based u64).
 * For production, consider a server-side monotonic counter or hash.
 */
export function generateDealId(): bigint {
  return BigInt(Date.now())
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function getStellarExpertAccountUrl(address: string): string {
  const networkPath = NETWORK === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${networkPath}/account/${address}`
}

export function getStellarExpertTxUrl(txHash: string): string {
  const networkPath = NETWORK === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${networkPath}/tx/${txHash}`
}

export function formatLedgerWindow(ledgers: number): string {
  const days = Math.max(1, Math.round(ledgers / LEDGERS_PER_DAY))
  return `${days} day${days === 1 ? '' : 's'}`
}

// ─── Enhanced deadline display with timestamp ─────────────────────────────────

/**
 * Format deadline with exact timestamp and countdown
 * Returns: "Expires May 5 at 2:30 PM · 3d 4h remaining" or "Expired"
 */
export function formatDeadlineWithTime(timeoutLedger: number, currentLedger: number): string {
  if (currentLedger >= timeoutLedger) return 'Expired'
  
  const targetDate = ledgerToDate(timeoutLedger, currentLedger)
  const timestamp = format(targetDate, 'MMM d \'at\' h:mm a')
  const countdown = formatDistanceToNow(targetDate)
  
  return `Expires ${timestamp} · ${countdown} remaining`
}

/**
 * Get just the date portion of a deadline
 * Returns: "May 5, 2026 at 2:30 PM"
 */
export function formatDeadlineDate(timeoutLedger: number, currentLedger: number): string {
  if (currentLedger >= timeoutLedger) return 'Expired'
  
  const targetDate = ledgerToDate(timeoutLedger, currentLedger)
  return format(targetDate, 'MMM d, yyyy \'at\' h:mm a')
}
