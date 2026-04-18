import {
  Account,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  Address,
  nativeToScVal,
  rpc as SorobanRpc,
} from '@stellar/stellar-sdk'
import {
  getSorobanClient,
  CONTRACT_ID,
  ESCROW_ASSET_CONTRACT_ID,
  NETWORK_PASSPHRASE,
} from './client'
import type { Deal, DealStatus } from './types'

// ─── Ledger constants ─────────────────────────────────────────────────────────
// Stellar produces ~1 ledger per 5 seconds.

export const LEDGERS_PER_SECOND = 0.2
export const LEDGERS_PER_DAY = Math.round(60 * 60 * 24 * LEDGERS_PER_SECOND) // ≈ 17280

// ─── XLM decimal conversion ──────────────────────────────────────────────────
// XLM uses 7 decimal places (stroops).

export const XLM_DECIMALS = 10_000_000n // 1e7

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * Number(XLM_DECIMALS)))
}

export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / Number(XLM_DECIMALS)
}

// ─── ScVal helpers ────────────────────────────────────────────────────────────

function u64Val(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'u64' })
}

function i128Val(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'i128' })
}

function u32Val(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: 'u32' })
}

function addressVal(addr: string): xdr.ScVal {
  return new Address(addr).toScVal()
}

function stringVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' })
}

// ─── Deal deserialization ─────────────────────────────────────────────────────

function parseStatus(raw: unknown): DealStatus {
  const tag = (raw as { tag?: string })?.tag
  const map: Record<string, DealStatus> = {
    PendingPayment: 'PendingPayment',
    Funded: 'Funded',
    Completed: 'Completed',
    TimedOut: 'TimedOut',
  }
  return map[tag ?? ''] ?? 'PendingPayment'
}

export function parseDeal(scVal: xdr.ScVal): Deal {
  const native = scValToNative(scVal) as Record<string, unknown>
  return {
    deal_id: BigInt(String(native['deal_id'])),
    seller: String(native['seller']),
    buyer: native['buyer'] ? String(native['buyer']) : null,
    amount: BigInt(String(native['amount'])),
    timeout_ledger: Number(native['timeout_ledger']),
    item_name: String(native['item_name']),
    status: parseStatus(native['status']),
  }
}

// ─── Simulation helper ────────────────────────────────────────────────────────
// Build → simulate → assemble. Returns a ready-to-sign transaction XDR.

async function buildAndSimulate(
  server: SorobanRpc.Server,
  sourceAddress: string,
  operation: xdr.Operation,
): Promise<string> {
  const account = await server.getAccount(sourceAddress)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build()

  const sim = await server.simulateTransaction(tx)

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build()
  return assembled.toXDR()
}

function isLegacyAbiMismatch(err: unknown, method: string): boolean {
  if (!(err instanceof Error)) return false

  return (
    err.message.includes('MismatchingParameterLen') &&
    err.message.includes(method)
  )
}

// ─── Public contract helpers ──────────────────────────────────────────────────

const contract = new Contract(CONTRACT_ID)

/**
 * Read deal from contract — no signature needed. (FR-2.4 / US-005)
 */
const NULL_STELLAR_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

export async function getDeal(dealId: bigint): Promise<Deal> {
  const server = getSorobanClient()
  const account = new Account(NULL_STELLAR_ACCOUNT, '0')
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_deal', u64Val(dealId)))
    .setTimeout(30)
    .build()

  const result = await server.simulateTransaction(tx)
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`get_deal failed: ${result.error}`)
  }

  const returnVal = (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval
  if (!returnVal) throw new Error('No return value from get_deal')
  return parseDeal(returnVal)
}

/**
 * Build create_deal transaction XDR — caller must sign and submit. (US-001)
 */
export async function buildCreateDeal(params: {
  dealId: bigint
  seller: string
  amountStroops: bigint
  timeoutLedger: number
  itemName: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'create_deal',
    u64Val(params.dealId),
    addressVal(params.seller),
    i128Val(params.amountStroops),
    u32Val(params.timeoutLedger),
    stringVal(params.itemName),
  )
  return buildAndSimulate(server, params.seller, op)
}

/**
 * Build fund_deal transaction XDR — caller must sign and submit. (US-002)
 */
export async function buildFundDeal(params: {
  dealId: bigint
  buyer: string
}): Promise<string> {
  const server = getSorobanClient()

  try {
    const op = contract.call(
      'fund_deal',
      u64Val(params.dealId),
      addressVal(params.buyer),
    )
    return await buildAndSimulate(server, params.buyer, op)
  } catch (err) {
    if (!isLegacyAbiMismatch(err, 'fund_deal')) throw err

    const legacyOp = contract.call(
      'fund_deal',
      u64Val(params.dealId),
      addressVal(params.buyer),
      addressVal(ESCROW_ASSET_CONTRACT_ID),
    )
    return buildAndSimulate(server, params.buyer, legacyOp)
  }
}

/**
 * Build confirm_receipt transaction XDR — buyer signs. (US-003)
 */
export async function buildConfirmReceipt(params: {
  dealId: bigint
  buyer: string
}): Promise<string> {
  const server = getSorobanClient()

  try {
    const op = contract.call(
      'confirm_receipt',
      u64Val(params.dealId),
      addressVal(params.buyer),
    )
    return await buildAndSimulate(server, params.buyer, op)
  } catch (err) {
    if (!isLegacyAbiMismatch(err, 'confirm_receipt')) throw err

    const legacyOp = contract.call(
      'confirm_receipt',
      u64Val(params.dealId),
      addressVal(params.buyer),
      addressVal(ESCROW_ASSET_CONTRACT_ID),
    )
    return buildAndSimulate(server, params.buyer, legacyOp)
  }
}

/**
 * Build claim_timeout transaction XDR — seller signs. (US-004)
 */
export async function buildClaimTimeout(params: {
  dealId: bigint
  seller: string
}): Promise<string> {
  const server = getSorobanClient()

  try {
    const op = contract.call(
      'claim_timeout',
      u64Val(params.dealId),
      addressVal(params.seller),
    )
    return await buildAndSimulate(server, params.seller, op)
  } catch (err) {
    if (!isLegacyAbiMismatch(err, 'claim_timeout')) throw err

    const legacyOp = contract.call(
      'claim_timeout',
      u64Val(params.dealId),
      addressVal(params.seller),
      addressVal(ESCROW_ASSET_CONTRACT_ID),
    )
    return buildAndSimulate(server, params.seller, legacyOp)
  }
}

/**
 * Get current ledger sequence — used to compute timeoutLedger from days. (US-001)
 */
export async function getCurrentLedger(): Promise<number> {
  const server = getSorobanClient()
  const info = await server.getLatestLedger()
  return info.sequence
}
