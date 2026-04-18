# Delivery Protection Redesign

## Why This Exists

The current SwapProof MVP uses a single timeout rule:

- Buyer locks funds.
- Buyer confirms receipt to release funds early.
- If the buyer does nothing until timeout, the seller can claim the escrow.

This protects sellers from ghost buyers, but it does **not** protect buyers when an item is never shipped or never arrives. In the current design, timeout does not prove delivery. It only proves that the buyer did not confirm in time.

This document defines a safer next-step design and the user stories needed to implement it.

## Problem Statement

Current behavior creates this risk:

1. Seller creates a deal.
2. Buyer opens the link and funds the escrow.
3. Seller never ships, or the item never arrives.
4. Buyer waits past the current timeout.
5. Seller can still claim the funds.

That outcome is acceptable only if the product intentionally favors the seller on timeout. If SwapProof should also protect buyers from non-delivery, the contract flow must change.

## Product Goal

Introduce a delivery-protection flow where:

- buyers are protected before the seller ships,
- sellers are protected after shipment if the buyer goes inactive,
- the contract no longer assumes that timeout alone means the seller deserves payment.

## Recommended Redesign

Replace the single timeout model with a two-stage lifecycle:

1. `ship_deadline_ledger`
2. `buyer_confirm_deadline_ledger`

Recommended states:

- `PendingPayment`
- `FundedAwaitingShipment`
- `ShippedAwaitingReceipt`
- `Completed`
- `Refunded`
- `SellerClaimed`

Recommended actions:

- `create_deal`
- `fund_deal`
- `mark_shipped`
- `confirm_receipt`
- `claim_refund`
- `claim_seller_timeout`

### Intended Behavior

- After funding, the deal enters `FundedAwaitingShipment`.
- The seller must mark the item as shipped before `ship_deadline_ledger`.
- If the seller does not mark shipment in time, the buyer can reclaim funds.
- Once the seller marks shipped, the deal enters `ShippedAwaitingReceipt`.
- The buyer can confirm receipt at any time before `buyer_confirm_deadline_ledger`.
- If the buyer stays inactive after shipment and the buyer-confirm deadline passes, the seller can claim.

## Important Limitation

This redesign improves fairness, but it still does **not** prove real-world delivery.

If `mark_shipped` is only a seller-declared action, then:

- it proves the seller claimed shipment,
- it does not prove the package was actually shipped,
- it does not prove the buyer received the item.

For stronger buyer protection, a later version would need at least one of these:

- courier or logistics oracle integration,
- proof-of-delivery integration,
- manual dispute resolution,
- third-party arbitration.

## Proposed Contract Changes

### Deal Data

Extend the on-chain `Deal` model with fields for the two-stage flow.

Recommended additions:

- `ship_deadline_ledger: u32`
- `buyer_confirm_deadline_ledger: u32`
- `shipped_at_ledger: Option<u32>`
- updated `status` enum values

### Function Rules

#### `create_deal`

- Seller defines item, amount, ship deadline, and buyer confirmation deadline.
- `buyer_confirm_deadline_ledger` must be after `ship_deadline_ledger`.

#### `fund_deal`

- Buyer locks funds.
- Deal moves to `FundedAwaitingShipment`.
- Seller cannot claim at this stage.

#### `mark_shipped`

- Seller only.
- Allowed only while the deal is `FundedAwaitingShipment`.
- Allowed only before `ship_deadline_ledger`.
- Sets `shipped_at_ledger`.
- Moves deal to `ShippedAwaitingReceipt`.

#### `confirm_receipt`

- Buyer only.
- Allowed only while the deal is `ShippedAwaitingReceipt`.
- Transfers escrow to seller.
- Moves deal to `Completed`.

#### `claim_refund`

- Buyer only.
- Allowed only while the deal is `FundedAwaitingShipment`.
- Allowed only after `ship_deadline_ledger` passes.
- Not allowed if shipment was already marked.
- Returns escrow to buyer.
- Moves deal to `Refunded`.

#### `claim_seller_timeout`

- Seller only.
- Allowed only while the deal is `ShippedAwaitingReceipt`.
- Allowed only after `buyer_confirm_deadline_ledger` passes.
- Transfers escrow to seller.
- Moves deal to `SellerClaimed`.

## Frontend Changes

### Create Deal Flow

- Replace the single timeout input with two inputs:
- shipping window
- buyer confirmation window

The UI should explain both in plain language:

- shipping deadline: when the seller must ship
- confirmation deadline: how long the buyer has to confirm after shipment

### Deal Page

Show:

- current status
- both deadlines
- current allowed actor
- next possible action

Recommended action visibility:

- Buyer sees `Lock Funds` only in `PendingPayment`
- Seller sees `Mark Shipped` only in `FundedAwaitingShipment`
- Buyer sees `Confirm Receipt` only in `ShippedAwaitingReceipt`
- Buyer sees `Claim Refund` only after ship deadline passes without shipment
- Seller sees `Claim Payment` only after buyer confirmation deadline passes post-shipment

### Copy Updates

The current timeout wording must be changed. The app should no longer say or imply:

- "If you do nothing, funds automatically release to the seller after timeout"

Instead, copy should explain the two-stage protection model clearly.

## User Stories

### US-013 Create Deal With Delivery Protection

As a seller, I want to create a deal with both a shipping deadline and a buyer confirmation deadline so the escrow rules are clear before the buyer funds it.

Acceptance criteria:

- Seller can configure both deadlines during deal creation.
- The contract stores both deadlines on-chain.
- The frontend shows both deadlines before funding.

### US-014 Buyer Funds a Shipment-Protected Deal

As a buyer, I want my funds to remain protected until the seller marks shipment so I am not exposed to a seller-favoring timeout before shipment.

Acceptance criteria:

- Funding moves the deal to `FundedAwaitingShipment`.
- Seller cannot claim funds from this state.
- Buyer can see that shipment is still pending.

### US-015 Seller Marks Item as Shipped

As a seller, I want to mark the deal as shipped so the buyer receipt-confirmation window begins.

Acceptance criteria:

- Only the seller can mark shipped.
- Shipment can only be marked before the shipping deadline.
- Status changes to `ShippedAwaitingReceipt`.
- Shipment timestamp or ledger is recorded.

### US-016 Buyer Confirms Receipt

As a buyer, I want to confirm receipt after delivery so the seller gets paid immediately.

Acceptance criteria:

- Only the funded buyer can confirm receipt.
- Confirmation is allowed only after shipment is marked.
- Escrow transfers to seller.
- Status changes to `Completed`.

### US-017 Buyer Claims Refund for Non-Shipment

As a buyer, I want to reclaim my funds if the seller fails to ship before the shipping deadline.

Acceptance criteria:

- Only the funded buyer can claim refund.
- Refund is allowed only after the shipping deadline passes.
- Refund is blocked if the seller already marked shipment.
- Escrow returns to buyer.
- Status changes to `Refunded`.

### US-018 Seller Claims After Buyer Inactivity

As a seller, I want to claim payment if I already shipped and the buyer never confirms within the buyer confirmation window.

Acceptance criteria:

- Seller claim is allowed only after shipment is marked.
- Seller claim is allowed only after the buyer confirmation deadline passes.
- Escrow transfers to seller.
- Status changes to `SellerClaimed`.

### US-019 Viewer Understands Current Deal Phase

As any viewer, I want to see the exact state of the deal and the next allowed action so I can understand who can act and why.

Acceptance criteria:

- Deal page shows the current lifecycle phase.
- Deal page shows both deadlines.
- The UI explains the next valid action in plain language.
- Invalid actions are hidden or disabled with correct messaging.

## Suggested Test Scenarios

### Contract Tests

- buyer funds, seller never marks shipped, buyer claims refund after ship deadline
- seller tries to claim before shipment and is rejected
- seller marks shipped, buyer confirms, seller receives funds
- seller marks shipped, buyer stays inactive, seller claims after confirm deadline
- non-seller cannot mark shipped
- non-buyer cannot confirm receipt
- non-buyer cannot claim refund
- refund cannot happen after shipment is marked
- seller timeout claim cannot happen before buyer confirmation deadline

### Frontend Tests

- create-deal form validates both deadlines
- buyer sees shipment-protected copy before funding
- seller-only action renders correctly in funded-awaiting-shipment state
- buyer-only refund action appears only after missed ship deadline
- seller claim action appears only after shipment plus confirm-deadline expiry

## Out of Scope For This Version

- courier integrations
- proof-of-delivery or shipping receipt verification
- manual dispute resolution
- admin arbitration
- reputation scoring tied to delivery outcomes

## Default Assumptions

- This version remains fully on-chain for fund movement.
- There is no trusted off-chain database deciding outcomes.
- `mark_shipped` is a workflow transition, not proof of real delivery.
- Fairness is improved compared with the current MVP, but perfect delivery verification is intentionally deferred.

