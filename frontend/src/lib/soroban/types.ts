export type DealStatus =
  | 'PendingPayment'
  | 'FundedAwaitingShipment'
  | 'ShippedAwaitingReceipt'
  | 'Completed'
  | 'Refunded'
  | 'SellerClaimed'

export interface Deal {
  deal_id: bigint
  seller: string
  buyer: string | null
  escrow_token: string | null
  amount: bigint
  ship_deadline_ledger: number
  buyer_confirm_window_ledgers: number
  buyer_confirm_deadline_ledger: number | null
  shipped_at_ledger: number | null
  item_name: string
  status: DealStatus
}

export interface CreateDealFormValues {
  itemName: string
  amountXlm: number
  shipWindowDays: number
  buyerConfirmDays: number
}

export interface DealPageParams {
  dealId: string
}
