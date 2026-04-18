# SwapProof 🔒

> Trustless P2P escrow for informal marketplace transactions — buyer locks funds on Stellar, seller ships, funds release on confirmation or timeout. No arbiter. No platform. Just two wallets and a contract.

---

## Project Name

**SwapProof**
🔗 https://stellar.expert/explorer/testnet/tx/7228489917ef1f6edfa9cb30569254249dca2ed2bcf90b896b92f80907644d19
🔗 https://lab.stellar.org/r/testnet/contract/CA5SCE6S7LGM2FEIKSZ2S46COEYZSON7B7KI3Z7WXZXMBZIUW4ZOU3TV
🔗 https://stellar.expert/explorer/testnet/tx/7228489917ef1f6edfa9cb30569254249dca2ed2bcf90b896b92f80907644d19
🔗 https://lab.stellar.org/r/testnet/contract/CA5SCE6S7LGM2FEIKSZ2S46COEYZSON7B7KI3Z7WXZXMBZIUW4ZOU3TV

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
| **Soroban smart contracts** | Core escrow logic — deal creation, fund locking, release, timeout claim |
| **XLM transfers (Native)** | Escrow token; stable value, no volatility during the deal window |
| **On-chain events** | `created`, `funded`, `completed`, `timed_out` — full public audit trail |

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
Seller creates deal (item, price, timeout)
  → create_deal() stored on-chain, buyer: null
  → Shareable link generated: /deal/{deal_id}

Seller pastes link into Facebook Messenger chat

Buyer opens link, connects Freighter wallet, reviews terms
  → fund_deal() locks XLM in contract, binds buyer address on-chain
  → Deal status: FUNDED

Buyer receives item, taps Confirm Receipt
  → confirm_receipt() transfers XLM to seller
  → Deal status: COMPLETED ✅

  OR

Buyer ghosts past timeout window
  → Seller taps Claim Payment
  → claim_timeout() transfers XLM to seller
  → Deal status: COMPLETED (TIMEOUT) ✅
```

---

## Why This Wins

SwapProof targets the single most common trust failure in SEA informal commerce — the take-the-money-and-disappear scam — with a two-minute demo-able flow that requires no crypto knowledge from the buyer, costs near-zero in fees on Stellar, and is composable with any future courier oracle or reputation layer. Judges see a real user, a real pain, and a contract that actually moves money.

---

## Optional Edge

**Shareable deal link UX** — the seller never needs to explain blockchain to the buyer. One link in Messenger opens a mobile-friendly page that shows the item, price, and timeout in plain language. The buyer connects Freighter and locks funds in one tap. No jargon, no app install, no friction.

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
| `create_deal` | Seller | Registers deal with no buyer assigned; emits `created` |
| `fund_deal` | Buyer | Locks XLM; binds buyer address on-chain; emits `funded` |
| `confirm_receipt` | Buyer only | Releases XLM to seller; closes deal |
| `claim_timeout` | Seller only | Claims XLM after timeout passes; closes deal |
| `get_deal` | Anyone | Read-only; returns full deal state — source of truth |

Contract state is the authoritative source of truth for fund status. Off-chain systems may cache for UX but must not decide fund movement.

---

## Prerequisites

```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI (v21+)
cargo install --locked stellar-cli --features opt

stellar --version  # should print 21.x.x or higher
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
# test tests::test_happy_path_confirm_receipt ... ok
# test tests::test_timeout_claim_by_seller ... ok
# test tests::test_duplicate_deal_rejected ... ok
# test tests::test_unauthorized_confirm_rejected ... ok
# test tests::test_early_timeout_claim_rejected ... ok
# test result: ok. 5 passed; 0 failed
```

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
  --deal_id   "deal_abc123" \
  --seller    <SELLER_G...> \
  --amount    15000000 \
  --timeout   1000 \
  --item_name "iPhone 11 64GB Space Gray"
```

### `fund_deal` — Buyer locks funds and is bound on-chain
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source buyer_wallet \
  --network testnet \
  -- fund_deal \
  --deal_id <DEAL_ID> \
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
