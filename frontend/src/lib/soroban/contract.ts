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

export const LEDGERS_PER_SECOND = 0.2
export const LEDGERS_PER_DAY = Math.round(60 * 60 * 24 * LEDGERS_PER_SECOND)

export const XLM_DECIMALS = 10_000_000n

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * Number(XLM_DECIMALS)))
}

export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / Number(XLM_DECIMALS)
}

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

function optionalString(value: unknown): string | null {
  return value ? String(value) : null
}

function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function parseStatus(raw: unknown): DealStatus {
  const tag =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0]
        : (raw as { tag?: string })?.tag

  const map: Record<string, DealStatus> = {
    PendingPayment: 'PendingPayment',
    FundedAwaitingShipment: 'FundedAwaitingShipment',
    ShippedAwaitingReceipt: 'ShippedAwaitingReceipt',
    Completed: 'Completed',
    Refunded: 'Refunded',
    SellerClaimed: 'SellerClaimed',
  }

  return map[tag ?? ''] ?? 'PendingPayment'
}

export function parseDeal(scVal: xdr.ScVal): Deal {
  const native = scValToNative(scVal) as Record<string, unknown>
  return {
    deal_id: BigInt(String(native['deal_id'])),
    seller: String(native['seller']),
    buyer: optionalString(native['buyer']),
    escrow_token: optionalString(native['escrow_token']),
    amount: BigInt(String(native['amount'])),
    ship_deadline_ledger: Number(native['ship_deadline_ledger']),
    buyer_confirm_window_ledgers: Number(native['buyer_confirm_window_ledgers']),
    buyer_confirm_deadline_ledger: optionalNumber(native['buyer_confirm_deadline_ledger']),
    shipped_at_ledger: optionalNumber(native['shipped_at_ledger']),
    item_name: String(native['item_name']),
    status: parseStatus(native['status']),
  }
}

async function buildAndSimulate(
  server: SorobanRpc.Server,
  sourceAddress: string,
  method: string,
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
    const message = String(sim.error ?? 'Unknown simulation error')
    if (message.includes('MismatchingParameterLen')) {
      throw new Error(
        `The deployed contract ABI does not match this frontend for \`${method}\`. Redeploy the updated contract, then update VITE_CONTRACT_ID_TESTNET or VITE_CONTRACT_ID_MAINNET to the new contract ID.`,
      )
    }

    throw new Error(`Simulation failed: ${message}`)
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build()
  return assembled.toXDR()
}

const contract = new Contract(CONTRACT_ID)
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

export async function buildCreateDeal(params: {
  dealId: bigint
  seller: string
  amountStroops: bigint
  shipDeadlineLedger: number
  buyerConfirmWindowLedgers: number
  itemName: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'create_deal',
    u64Val(params.dealId),
    addressVal(params.seller),
    i128Val(params.amountStroops),
    u32Val(params.shipDeadlineLedger),
    u32Val(params.buyerConfirmWindowLedgers),
    stringVal(params.itemName),
  )
  return buildAndSimulate(server, params.seller, 'create_deal', op)
}

export async function buildFundDeal(params: {
  dealId: bigint
  buyer: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'fund_deal',
    u64Val(params.dealId),
    addressVal(params.buyer),
    addressVal(ESCROW_ASSET_CONTRACT_ID),
  )
  return buildAndSimulate(server, params.buyer, 'fund_deal', op)
}

export async function buildMarkShipped(params: {
  dealId: bigint
  seller: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'mark_shipped',
    u64Val(params.dealId),
    addressVal(params.seller),
  )
  return buildAndSimulate(server, params.seller, 'mark_shipped', op)
}

export async function buildConfirmReceipt(params: {
  dealId: bigint
  buyer: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'confirm_receipt',
    u64Val(params.dealId),
    addressVal(params.buyer),
  )
  return buildAndSimulate(server, params.buyer, 'confirm_receipt', op)
}

export async function buildClaimRefund(params: {
  dealId: bigint
  buyer: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'claim_refund',
    u64Val(params.dealId),
    addressVal(params.buyer),
  )
  return buildAndSimulate(server, params.buyer, 'claim_refund', op)
}

export async function buildClaimSellerTimeout(params: {
  dealId: bigint
  seller: string
}): Promise<string> {
  const server = getSorobanClient()
  const op = contract.call(
    'claim_seller_timeout',
    u64Val(params.dealId),
    addressVal(params.seller),
  )
  return buildAndSimulate(server, params.seller, 'claim_seller_timeout', op)
}

export async function getCurrentLedger(): Promise<number> {
  const server = getSorobanClient()
  const info = await server.getLatestLedger()
  return info.sequence
}
