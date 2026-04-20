# SwapProof 🔒

> Trustless P2P escrow for informal marketplace transactions — buyer locks funds on Stellar, seller ships, funds release on confirmation or timeout. No arbiter. No platform. Just two wallets and a contract. Each deal pins a seller-approved escrow asset on-chain so payout logic cannot be redirected later.

---

## Project Name

**SwapProof**
🔗 https://swap-proof-stellar-ten.vercel.app/
🔗 https://stellar.expert/explorer/testnet/tx/82e8a12e5e92a431b8bfd8d66363d151c445038c69905484e7ac3979a462085d
🔗 https://lab.stellar.org/r/testnet/contract/CDCFFRWODNDSRTFWQAIXON22G7JYLVQW5UUQKE4YBMNAKDTVDQ2OUSPU

---

## Problem

A buyer in a Philippine Facebook buy-and-sell group sends ₱1,500 via GCash to a stranger for a secondhand phone — the seller stops replying, the money is gone, and there is no platform, no support team, and no recourse.

---

## Solution

SwapProof locks the buyer's XLM in a Soroban smart contract the moment they open a shareable deal link; the seller receives payment only after the buyer confirms receipt, and if the buyer ghosts past the agreed timeout, the seller claims automatically — Stellar provides the speed, near-zero fees, and trustless finality that make this viable for transactions as small as ₱300.

---

## Stellar Features Used

| Feature | Usage |
|---|---|
| **Soroban smart contracts** | Core escrow logic with 7 functions and 6 deal states, with escrow token pinned per deal |
| **XLM transfers (Native)** | Escrow token; stable value, no volatility during deal window |
| **On-chain events** | `created`, `funded`, `shipped`, `complete`, `refund`, `sellerclm` — full audit trail |
| **Ledger-based timing** | Deadlines calculated in ledger sequences (~5-6 seconds each) |
| **Persistent storage** | Deal state stored permanently on-chain |
| **Multi-party authorization** | Separate auth for seller/buyer actions with state validation |

---

## Target Users

| | Buyer | Seller |
|---|---|---|
| **Who** | Filipino consumer browsing Facebook buy-and-sell groups | Individual reseller or secondhand seller on informal marketplaces |
| **Income** | Lower-middle income, GCash/Maya user, not crypto-native | Same demographic; primary fear is non-payment after shipping |
| **Where** | Philippines (SEA); behavior applies to Carousell, OLX across the region |
| **Why they care** | Has been scammed or knows someone who has; wants payment protection without a middleman fee |

---

## Core Feature (MVP)

**The escrow loop — demo-able in under 2 minutes:**

```
Seller creates deal (item, price, shipping window, buyer review window)
  → create_deal() stored on-chain with seller-approved escrow token, buyer: null
  → Shareable link generated: /deal/{deal_id}

Seller pastes link into Facebook Messenger chat

Buyer opens link, connects Freighter wallet, reviews terms
  → fund_deal() must match the escrow token already pinned by the seller
  → buyer address is bound on-chain
  → Deal status: FUNDED

Seller ships item, marks as shipped on-chain
  → mark_shipped() records shipment, starts buyer confirmation window
  → Deal status: SHIPPED

Buyer receives item, taps Confirm Receipt
  → confirm_receipt() transfers XLM to seller
  → Deal status: COMPLETED ✅

  OR (if seller misses shipping deadline)

Buyer taps Claim Refund
  → claim_refund() returns XLM to buyer
  → Deal status: REFUNDED ✅

  OR (if buyer misses confirmation deadline)

Seller taps Claim Payment
  → claim_seller_timeout() transfers XLM to seller
  → Deal status: SELLER_CLAIMED ✅
```

---

## Deal States

| Status | Description |
|---|---|
| `PendingPayment` | Deal created, waiting for buyer to fund escrow |
| `FundedAwaitingShipment` | Buyer locked funds, seller must mark shipped before deadline |
| `ShippedAwaitingReceipt` | Item shipped, buyer must confirm receipt before deadline |
| `Completed` | Buyer confirmed receipt, funds released to seller |
| `Refunded` | Seller missed shipping deadline, buyer reclaimed funds |
| `SellerClaimed` | Buyer missed confirmation deadline, seller claimed funds |

## Optional Edge

**Shareable deal link UX** — the seller never needs to explain blockchain to the buyer. One link in Messenger opens a mobile-friendly page that shows the item, price, and timeout in plain language. The buyer connects Freighter and locks funds in one tap. No jargon, no app install, no friction.

---

## Frontend Features

### Core Pages
- **HomePage** - Landing page with hero, pillars, and how-it-works flow
- **CreateDealPage** - Form to create new escrow deals with wallet connection
- **DealPage** - Shareable deal link with real-time status tracking

### Key Components
- **DealCard** - Displays deal details, status, and countdown timers
- **CreateDealForm** - Multi-step form with validation and AI title optimization
- **DealActions** - Context-aware buttons (Fund, Mark Shipped, Confirm Receipt, Claim)
- **Wallet Integration** - Freighter wallet connection and transaction signing

### Recent Features
- **AI Title Optimizer** - Uses Google Gemini AI to suggest optimized product titles for better searchability
- **Custom Time Windows** - Sellers can pick preset or custom shipping/review windows (with validation bounds)
- **Enhanced Deadline Display** - Shows exact expiration dates/times (e.g., "Expires May 5 at 2:30 PM · 3d 4h remaining")
- **Real-time Ledger Polling** - Updates deal status every 15 seconds
- **Mobile-First Design** - Responsive UI built with Tailwind CSS and Radix UI

### Tech Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Zustand** for state management
- **Stellar SDK** for blockchain interactions
- **Tailwind CSS** + **Radix UI** for styling
- **date-fns** for date formatting
- **Sonner** for toast notifications

---

## Constraints

- **Region:** SEA (Philippines primary)
- **User type:** Informal marketplace buyers and sellers
- **Complexity:** Soroban required, Mobile-first frontend
- **Theme:** Marketplace escrow

---

## Contract Functions

| Function | Caller | What it does |
|---|---|---|
| `create_deal` | Seller | Registers deal with no buyer assigned and pins the seller-approved escrow token; emits `created` event |
| `fund_deal` | Buyer | Locks the pinned escrow asset in escrow; binds buyer address on-chain; emits `funded` event |
| `mark_shipped` | Seller only | Records shipment on-chain; starts buyer confirmation window; emits `shipped` event |
| `confirm_receipt` | Buyer only | Releases the deal's pinned escrow token to seller; closes deal; emits `complete` event |
| `claim_refund` | Buyer only | Returns the deal's pinned escrow token after seller misses shipping deadline; emits `refund` event |
| `claim_seller_timeout` | Seller only | Claims the deal's pinned escrow token after buyer misses confirmation deadline; emits `sellerclm` event |
| `get_deal` | Anyone | Read-only; returns full deal state — source of truth |

Contract state is the authoritative source of truth for fund status. Off-chain systems may cache for UX but must not decide fund movement.

The deal record now stores the escrow asset at creation time and settlement/refund actions always use that stored token instead of accepting a new token address from the caller.

---

## Prerequisites

### Contract Development
```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI (v21+)
cargo install --locked stellar-cli --features opt

stellar --version  # should print 21.x.x or higher
```

### Frontend Development
```bash
# Node.js 18+
node --version  # should print 18.x.x or higher

# pnpm package manager
npm install -g pnpm

# Google Gemini API key (optional, for AI features)
# Get from: https://aistudio.google.com/app/apikey
```

---

## Build

```bash
stellar contract build
# Output: target/wasm32-unknown-unknown/release/swap_proof.wasm
```

---

## Test

```bash
cargo test

# Expected:
# test tests::test_happy_path_ship_then_confirm ... ok
# test tests::test_buyer_can_refund_after_missed_shipping_deadline ... ok
# test tests::test_seller_can_claim_after_shipping_and_buyer_inactivity ... ok
# test tests::test_confirm_receipt_rejected_for_non_buyer ... ok
# test tests::test_non_seller_cannot_mark_shipped ... ok
# test tests::test_refund_rejected_before_shipping_deadline ... ok
# test tests::test_seller_claim_rejected_before_confirm_deadline ... ok
# test tests::test_duplicate_deal_id_rejected ... ok
# test tests::test_confirm_receipt_uses_pinned_escrow_token_only ... ok
# test result: ok. 9 passed; 0 failed
```

## Frontend Setup

```bash
cd frontend

# Install dependencies
pnpm install

# Copy environment template
cp .env.local.example .env.local

# Add your Gemini API key to .env.local
echo "VITE_GEMINI_API_KEY=your-api-key-here" >> .env.local

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Environment Variables
- `VITE_GEMINI_API_KEY` - Google Gemini API key for AI title optimization (optional)

### Deployment
The frontend is configured for Vercel deployment with SPA routing.

---

## Deploy to Testnet

```bash
# Fund a testnet identity
stellar keys generate swapproof_admin --network testnet
stellar keys fund swapproof_admin --network testnet

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/swap_proof.wasm \
  --source swapproof_admin \
  --network testnet
# → Outputs CONTRACT_ID (C...)
```

---

## Get XLM Token Contract Address

For testnet XLM (native asset):

```bash
# Native XLM SAC on testnet
stellar contract id asset --asset native --network testnet
# Returns a C... token contract address

# For XLM on testnet (native asset)
stellar contract id asset --asset native --network testnet
```

---

## Sample CLI Invocations

### `create_deal` — Seller creates a deal
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source seller_wallet \
  --network testnet \
  -- create_deal \
  --deal_id 123 \
  --seller <SELLER_G...> \
  --amount 15000000 \
  --ship_deadline_ledger 1000 \
  --buyer_confirm_window_ledgers 200 \
  --item_name "iPhone 11 64GB Space Gray"
```

### `fund_deal` — Buyer locks funds and is bound on-chain
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source buyer_wallet \
  --network testnet \
  -- fund_deal \
  --deal_id 123 \
  --buyer <BUYER_G...> \
  --token_address <XLM_CONTRACT_ID>
```

### `mark_shipped` — Seller records shipment on-chain
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source seller_wallet \
  --network testnet \
  -- mark_shipped \
  --deal_id 123 \
  --seller <SELLER_G...>
```

### `confirm_receipt` — Buyer confirms delivery and releases funds
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source buyer_wallet \
  --network testnet \
  -- confirm_receipt \
  --deal_id 123 \
  --buyer <BUYER_G...> \
  --token_address <XLM_CONTRACT_ID>
```
  --buyer   <BUYER_G...>
```

### `confirm_receipt` — Buyer confirms item received, funds released to seller
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source buyer_wallet \
  --network testnet \
  -- confirm_receipt \
  --deal_id <DEAL_ID>
```

### `claim_timeout` — Seller claims after timeout window passes
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source seller_wallet \
  --network testnet \
  -- claim_timeout \
  --deal_id <DEAL_ID>
```

### `get_deal` — Anyone reads current deal state (no source required)
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_deal \
  --deal_id <DEAL_ID>
```

---

## Common Errors and Fixes

### `DealNotFound`
- **Cause:** `deal_id` does not exist on-chain.
- **Fix:** Verify the deal ID matches exactly what was returned at creation.

### `DealAlreadyFunded`
- **Cause:** `fund_deal()` called on a deal that is already in FUNDED or COMPLETED status.
- **Fix:** Use `get_deal()` to check current status before attempting to fund.

### `UnauthorizedCaller`
- **Cause:** `confirm_receipt()` called by a wallet that is not the registered buyer, or `claim_timeout()` called by a non-seller wallet.
- **Fix:** Ensure the signing wallet matches the address registered on-chain for that role.

### `TimeoutNotReached`
- **Cause:** `claim_timeout()` called before `timeout_ledger` has passed.
- **Fix:** Check `get_deal()` for the `timeout_ledger` value and wait until current ledger exceeds it.

### `AlreadyCompleted`
- **Cause:** Attempted a write action on a deal already in COMPLETED or TIMED_OUT status.
- **Fix:** Deal is permanently closed. No further actions are possible on this deal ID.

### `zero balance is not sufficient to spend`
- **Cause:** The buyer's wallet has insufficient XLM to cover the deal amount.
- **Fix:** Fund the buyer wallet with testnet XLM before calling `fund_deal()`.

---

## Suggested MVP Timeline

| Day | Milestone |
|---|---|
| 1 | Soroban contract coded — all 5 functions + 5 unit tests passing |
| 2 | Deploy to testnet, verify all CLI invocations end-to-end |
| 3 | React frontend — deal creation form + public deal status page + Freighter connect |
| 4 | Shareable link flow tested: create → share → open → fund → confirm |
| 5 | Polish, record 2-minute demo, finalize README, submit |

---

## Frontend (React + Vite)

### Configure environment

```bash
cd frontend
cp .env.example .env
```

Set the following in `.env`:

```
VITE_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_C...>
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

### Run

```bash
cd frontend
npm install
npm run dev
```

Expected user flows in UI:

1. **Seller** — fills create deal form → copies shareable link
2. **Buyer** — opens link → connects Freighter → reviews terms → locks funds
3. **Buyer** — taps Confirm Receipt after item arrives
4. **Seller** — taps Claim Payment after timeout (if buyer ghosts)
5. **Anyone** — views live deal status at `/deal/{deal_id}`

> Freighter must be set to Testnet. The connected wallet must match the role required for each action.

---

## Frontend Notes

- `fund_token` must be a Soroban token contract address (`C...`), not a wallet (`G...`).
- `release` transfers USDC **from the contract balance** to the seller. The contract must hold USDC (locked by the buyer at `fund_deal` time).
- Public deal page (`/deal/{deal_id}`) is readable by anyone — no wallet connection required to view status.
- Write actions require a wallet signature — connect Freighter before calling `fund_deal`, `confirm_receipt`, or `claim_timeout`.

---

## Reference Repositories

- Stellar Bootcamp 2026: https://github.com/armlynobinguar/Stellar-Bootcamp-2026
- GrantProof (related project — NGO fund accountability on Stellar): https://github.com/armlynobinguar/community-treasury

---

## License

MIT License © 2026 SwapProof