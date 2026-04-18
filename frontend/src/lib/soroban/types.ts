// ─── Contract Types ────────────────────────────────────────────────────────────
// Mirror of the Rust contract's domain types.

export type DealStatus = 'PendingPayment' | 'Funded' | 'Completed' | 'TimedOut'

export interface Deal {
  deal_id: bigint
  seller: string            // Stellar address (G...)
  buyer: string | null      // null until fund_deal() is called
  amount: bigint            // XLM in 7-decimal stroops
  timeout_ledger: number    // Stellar ledger sequence number
  item_name: string
  status: DealStatus
}

// ─── UI / form types ──────────────────────────────────────────────────────────

export interface CreateDealFormValues {
  itemName: string
  amountXlm: number        // plain XLM — converted to stroops before tx
  timeoutDays: number       // 1–14 — converted to ledger offset before tx
}

export interface DealPageParams {
  dealId: string            // URL param — cast to BigInt for contract calls
}
