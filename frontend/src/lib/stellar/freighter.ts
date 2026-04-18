import {
  isConnected,
  getPublicKey,
  signTransaction,
  setAllowed,
  requestAccess,
} from '@stellar/freighter-api'
import { NETWORK_PASSPHRASE } from '@/lib/soroban/client'

// ─── Freighter detection ──────────────────────────────────────────────────────

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    return await isConnected()
  } catch {
    return false
  }
}

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectFreighter(): Promise<string> {
  const installed = await isFreighterInstalled()
  if (!installed) {
    throw new Error(
      'Freighter extension is not installed. Please install it from freighter.app.',
    )
  }

  // Request access — triggers the Freighter popup if not already allowed.
  await setAllowed()
  await requestAccess()

  const address = await getPublicKey()
  if (!address) {
    throw new Error('Failed to get address from Freighter.')
  }
  return address
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign a pre-built transaction XDR with Freighter.
 * Returns the signed XDR ready for submission.
 */
export async function signWithFreighter(xdr: string): Promise<string> {
  const signedTxXdr = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  if (!signedTxXdr) {
    throw new Error(
      'Freighter signing was cancelled or failed. Please confirm the popup and ensure your wallet is on the correct network.',
    )
  }
  return signedTxXdr
}
