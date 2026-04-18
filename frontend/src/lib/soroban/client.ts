import { Networks, rpc as SorobanRpc } from '@stellar/stellar-sdk'

// ─── Network config ──────────────────────────────────────────────────────────
// Controlled by VITE_STELLAR_NETWORK env var. (NFR-4.3)

const NETWORK = import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet'

export const NETWORK_PASSPHRASE =
  NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

export const RPC_URL =
  NETWORK === 'mainnet'
    ? import.meta.env.VITE_SOROBAN_RPC_URL_MAINNET
    : import.meta.env.VITE_SOROBAN_RPC_URL_TESTNET ??
      'https://soroban-testnet.stellar.org'

// ─── Contract address ─────────────────────────────────────────────────────────
// Set per-network in .env — never hardcode a contract ID in source.

export const CONTRACT_ID =
  NETWORK === 'mainnet'
    ? import.meta.env.VITE_CONTRACT_ID_MAINNET
    : import.meta.env.VITE_CONTRACT_ID_TESTNET

const DEFAULT_NATIVE_ASSET_CONTRACT_ID =
  NETWORK === 'mainnet'
    ? 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
    : 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

// Prefer an explicit escrow asset contract ID, but fall back to the native XLM SAC.
// Legacy env names are still supported so older local setups continue to work.
export const ESCROW_ASSET_CONTRACT_ID =
  NETWORK === 'mainnet'
    ? import.meta.env.VITE_ESCROW_ASSET_CONTRACT_ID_MAINNET ??
      import.meta.env.VITE_XLM_CONTRACT_ID_MAINNET ??
      import.meta.env.VITE_USDC_CONTRACT_ID_MAINNET ??
      DEFAULT_NATIVE_ASSET_CONTRACT_ID
    : import.meta.env.VITE_ESCROW_ASSET_CONTRACT_ID_TESTNET ??
      import.meta.env.VITE_XLM_CONTRACT_ID_TESTNET ??
      import.meta.env.VITE_USDC_CONTRACT_ID_TESTNET ??
      DEFAULT_NATIVE_ASSET_CONTRACT_ID

// ─── RPC client singleton ─────────────────────────────────────────────────────

let _client: SorobanRpc.Server | null = null

export function getSorobanClient(): SorobanRpc.Server {
  if (!_client) {
    _client = new SorobanRpc.Server(RPC_URL, { allowHttp: NETWORK !== 'mainnet' })
  }
  return _client
}
