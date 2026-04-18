# SwapProof Frontend — Developer Guide

> React + Vite (TypeScript) · shadcn/ui + Tailwind · Freighter wallet · Stellar Soroban

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Project Setup](#2-project-setup)
3. [Environment Variables](#3-environment-variables)
4. [Project Structure](#4-project-structure)
5. [Architecture Overview](#5-architecture-overview)
6. [Layer-by-Layer Walkthrough](#6-layer-by-layer-walkthrough)
   - [Soroban Client (`src/lib/soroban/`)](#61-soroban-client)
   - [Freighter Wrapper (`src/lib/stellar/`)](#62-freighter-wrapper)
   - [Wallet Store (`src/store/`)](#63-wallet-store)
   - [React Hooks (`src/hooks/`)](#64-react-hooks)
   - [Components (`src/components/`)](#65-components)
   - [Pages (`src/pages/`)](#66-pages)
7. [User Story → Code Map](#7-user-story--code-map)
8. [Running the App](#8-running-the-app)
9. [Deploying the Smart Contract](#9-deploying-the-smart-contract)
10. [Adding shadcn/ui Components](#10-adding-shadcnui-components)
11. [Testnet End-to-End Walkthrough](#11-testnet-end-to-end-walkthrough)
12. [Common Errors & Fixes](#12-common-errors--fixes)
13. [What's NOT in the Scaffold (Next Steps)](#13-whats-not-in-the-scaffold-next-steps)

---

## 1. Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Stellar CLI | latest | https://stellar.org/developers/stellar-cli |
| Freighter extension | latest | https://freighter.app |
| Rust + wasm-pack | stable | Required only if building the contract |

---

## 2. Project Setup

```bash
# 1. Clone / copy the scaffold
cd frontend

# 2. Install dependencies
pnpm install

# 3. Install required shadcn/ui primitives
pnpm dlx shadcn-ui@latest add button input label checkbox dialog separator tooltip badge

# 4. Copy and fill env file
cp .env.example .env.local
# → Edit .env.local (see Section 3)

# 5. Start dev server
pnpm dev
# → http://localhost:5173
```

---

## 3. Environment Variables

All variables are prefixed `VITE_` so Vite exposes them to the browser bundle.

```env
# .env.local

VITE_STELLAR_NETWORK=testnet          # "testnet" | "mainnet"

VITE_SOROBAN_RPC_URL_TESTNET=https://soroban-testnet.stellar.org
VITE_SOROBAN_RPC_URL_MAINNET=https://mainnet.sorobanrpc.com

# Paste contract ID after deploying (Section 9)
VITE_CONTRACT_ID_TESTNET=CXXX...
VITE_CONTRACT_ID_MAINNET=

# Testnet XLM (Native)
# Mainnet XLM (Native)
```

> **NFR-4.3 enforcement:** `VITE_STELLAR_NETWORK` controls which contract ID and RPC URL is used — testnet and mainnet are never mixed in the same build.

---

## 4. Project Structure

```
src/
├── lib/
│   ├── soroban/
│   │   ├── client.ts      ← RPC singleton, network config
│   │   ├── contract.ts    ← All contract call builders + get_deal()
│   │   └── types.ts       ← Deal, DealStatus TypeScript types
│   ├── stellar/
│   │   └── freighter.ts   ← connect / sign wrappers
│   └── utils.ts           ← formatXlm, formatAddress, cn(), etc.
│
├── store/
│   └── walletStore.ts     ← Zustand — wallet address, type
│
├── hooks/
│   ├── useFreighter.ts    ← connect, signAndSubmit, disconnect
│   ├── useDeal.ts         ← read deal from chain
│   ├── useCreateDeal.ts   ← create_deal() flow
│   └── useContractActions.ts  ← fund / confirm / claim
│
├── components/
│   ├── deal/              ← All deal UI pieces
│   ├── wallet/            ← ConnectWalletButton
│   └── layout/            ← AppShell, Navbar
│
└── pages/
    ├── HomePage.tsx
    ├── CreateDealPage.tsx
    └── DealPage.tsx        ← Central deal view (buyer + seller logic)
```

---

## 5. Architecture Overview

```
User Action
    │
    ▼
React Component  (pages/ or components/)
    │  calls
    ▼
Custom Hook      (hooks/)
    │  builds tx via
    ▼
contract.ts      (lib/soroban/contract.ts)
    │  simulates via
    ▼
Soroban RPC      (getSorobanClient())
    │  returns unsigned XDR
    ▼
freighter.ts     signWithFreighter(xdr)
    │  user signs in Freighter popup
    ▼
Soroban RPC      server.sendTransaction()
    │  polls for finality
    ▼
Hook returns txHash → Component shows toast → refetch deal
```

**Key principle:** The frontend never holds funds, never stores deal state in a DB, and never trusts a cache. Every deal status read goes directly to the Soroban RPC (`get_deal()`) — satisfying **FR-2.4** and **NFR-4.2**.

---

## 6. Layer-by-Layer Walkthrough

### 6.1 Soroban Client

**`src/lib/soroban/client.ts`**

Creates a singleton `SorobanRpc.Server` pointed at the correct network. Import `getSorobanClient()` anywhere you need to talk to Stellar.

```ts
import { getSorobanClient, CONTRACT_ID } from '@/lib/soroban/client'
```

**`src/lib/soroban/types.ts`**

TypeScript mirror of the Rust contract's `Deal` struct and `DealStatus` enum. Keep these in sync with the contract whenever you change on-chain types.

**`src/lib/soroban/contract.ts`**

All contract interactions live here:

| Function | Description |
|----------|-------------|
| `getDeal(dealId)` | Read-only — simulates `get_deal()`, no signing |
| `buildCreateDeal(params)` | Returns unsigned XDR for `create_deal()` |
| `buildFundDeal(params)` | Returns unsigned XDR for `fund_deal()` |
| `buildConfirmReceipt(params)` | Returns unsigned XDR for `confirm_receipt()` |
| `buildClaimTimeout(params)` | Returns unsigned XDR for `claim_timeout()` |
| `getCurrentLedger()` | Returns current ledger sequence |
| `xlmToStroops(n)` | `number → bigint` (7 decimals) |
| `stroopsToXlm(n)` | `bigint → number` |
| `LEDGERS_PER_DAY` | `≈ 17280` — used to convert days → ledger offset |

---

### 6.2 Freighter Wrapper

**`src/lib/stellar/freighter.ts`**

| Function | Description |
|----------|-------------|
| `isFreighterInstalled()` | Returns `true` if extension is present |
| `connectFreighter()` | Triggers popup, returns `G...` address |
| `signWithFreighter(xdr)` | Signs a tx XDR, returns signed XDR |

Do not call these directly in components — use the `useFreighter` hook instead.

---

### 6.3 Wallet Store

**`src/store/walletStore.ts`** — Zustand + `persist` middleware

```ts
const { address, isConnecting, setAddress, disconnect } = useWalletStore()
```

The address is persisted to `localStorage` under key `swapproof-wallet` so the user's wallet is remembered across page refreshes. The wallet is **not re-signed** automatically — Freighter handles session management itself.

---

### 6.4 React Hooks

#### `useFreighter`
The main entry point for wallet interactions. Composes the wallet store and the Freighter library.

```ts
const { address, isConnected, connect, disconnect, signAndSubmit } = useFreighter()
```

`signAndSubmit(unsignedXdr)` signs with Freighter, submits, polls for finality, and returns the `txHash`.

#### `useDeal(dealId)`
```ts
const { deal, loading, error, refetch } = useDeal(dealId)
```
Fetches deal from the contract on mount and whenever `refetch()` is called. After a successful action, call `refetch()` with a short delay (3s) to allow ledger finality.

#### `useCreateDeal`
```ts
const { createDeal, loading, error } = useCreateDeal()
const { dealId, txHash } = await createDeal({ itemName, amountXlm, timeoutDays })
```
Internally: generates a `dealId`, fetches current ledger, converts days → `timeoutLedger`, calls `buildCreateDeal`, signs, submits.

#### `useFundDeal` / `useConfirmReceipt` / `useClaimTimeout`
All follow the same pattern — call the hook, invoke the action with `dealId`, get back `txHash`.

---

### 6.5 Components

#### `DealStatusBadge`
Renders colored pill for `PendingPayment | Funded | Completed | TimedOut`.

#### `DealTimerCountdown`
Polls current ledger every 30s, updates countdown string every 1s. Calls `onExpire()` when timeout passes — used to activate the ClaimTimeout button.

#### `ShareDealLink`
Shows the deal URL with a one-tap copy button. Renders after deal creation (US-006).

#### `DealCard`
Full deal summary — item, amount (in XLM, never stroops), seller/buyer addresses (shortened), timeout countdown. Satisfies FR-2.5, FR-2.6, US-007.

#### `FundDealPanel`
Buyer's lock-funds UI. Shows deal terms, plain-language timeout explanation, confirmation checkbox (must check before `Lock Funds` button activates — US-008 AC), and XLM amount in button label.

#### `ConfirmReceiptButton` / `ClaimTimeoutButton`
Single-action buttons with loading state. `ClaimTimeoutButton` is disabled until `isExpired` is `true` — the timeout is enforced on-chain too (US-004 AC).

#### `ConnectWalletButton`
Handles both disconnected (shows "Connect Wallet") and connected (shows shortened address + disconnect) states.

---

### 6.6 Pages

#### `HomePage` — `/`
Marketing landing with pillar cards and "How it works" steps. No wallet required.

#### `CreateDealPage` — `/create`
Wallet-gated. Shows `ConnectWalletButton` if no wallet, otherwise shows `CreateDealForm`. On success, navigates to `/deal/:dealId?created=1`.

#### `DealPage` — `/deal/:dealId`
The most complex page — publicly accessible (no login needed, FR-2.2). Logic:

```
deal.status === 'PendingPayment'
  AND viewer is not seller  →  show FundDealPanel (or ConnectWalletButton)

deal.status === 'Funded'
  AND viewer IS buyer       →  show ConfirmReceiptButton

deal.status === 'Funded'
  AND viewer IS seller      →  show ClaimTimeoutButton (disabled until expired)

deal.status === 'Completed' | 'TimedOut'  →  show terminal state message
```

`justCreated=1` query param triggers `ShareDealLink` banner at the top.

---

## 7. User Story → Code Map

| User Story | Primary Files |
|------------|---------------|
| US-001 Create Deal | `CreateDealForm.tsx`, `useCreateDeal.ts`, `contract.ts#buildCreateDeal` |
| US-002 Lock Funds | `FundDealPanel.tsx`, `useContractActions.ts#useFundDeal` |
| US-003 Confirm Receipt | `DealActions.tsx#ConfirmReceiptButton`, `useContractActions.ts#useConfirmReceipt` |
| US-004 Claim Timeout | `DealActions.tsx#ClaimTimeoutButton`, `useContractActions.ts#useClaimTimeout` |
| US-005 View Deal Status | `DealPage.tsx`, `useDeal.ts`, `DealCard.tsx` |
| US-006 Share Deal Link | `ShareDealLink.tsx`, `CreateDealPage.tsx` |
| US-007 Open as Buyer | `DealPage.tsx` (public, no auth) |
| US-008 Preview Before Paying | `FundDealPanel.tsx` (checkbox + terms grid) |
| US-012 Freighter Connect | `ConnectWalletButton.tsx`, `useFreighter.ts`, `freighter.ts` |

---

## 8. Running the App

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm preview

# Type-check only
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## 9. Deploying the Smart Contract

You need the contract deployed before the frontend can talk to it.

```bash
# 1. Generate a deploy keypair (testnet)
stellar keys generate --global deployer --network testnet

# 2. Fund it from Friendbot
stellar keys fund deployer --network testnet

# 3. Build the contract (from the contract repo root)
cargo build --target wasm32-unknown-unknown --release

# 4. Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/swapproof.wasm \
  --source deployer \
  --network testnet

# → Outputs a contract ID like C...
# Paste this into VITE_CONTRACT_ID_TESTNET in .env.local

# 5. Verify deployment
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- get_deal --deal_id 0
# → Should panic "deal not found" (correct — no deals yet)
```

---

## 10. Adding shadcn/ui Components

The scaffold uses raw Radix + Tailwind for most UI. To add a full shadcn component:

```bash
# Example — add the Dialog component
pnpm dlx shadcn-ui@latest add dialog

# It installs to src/components/ui/dialog.tsx
# Import as:
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
```

You can use these to build the OTP modal (US-009) and on-ramp flow (US-010).

---

## 11. Testnet End-to-End Walkthrough

### Setup

1. Install the **Freighter** browser extension.
2. Create two Freighter accounts — label one **Seller**, one **Buyer**.
3. Fund both from Friendbot: `https://friendbot.stellar.org?addr=G...`
4. Get testnet XLM — use the [testnet faucet](https://laboratory.stellar.org/#account-creator?network=test) to fund your wallet.

### Flow

```
Seller browser tab                    Buyer browser tab
─────────────────────────────────────────────────────────
1. Connect Freighter (seller key)
2. Go to /create
3. Fill in: "iPhone 14", 200 XLM, 3-day timeout
4. Sign transaction in Freighter popup
5. Copy deal link from confirmation banner
                                      6. Open deal link
                                      7. Connect Freighter (buyer key)
                                      8. Review deal terms
                                      9. Check confirmation checkbox
                                      10. Click "Lock 200 XLM"
                                      11. Sign in Freighter popup
                                      ← Status updates to FUNDED →
                                      12. Click "I Received the Item"
                                      13. Sign in Freighter popup
                                      ← Status updates to COMPLETED →
14. Seller sees funds in wallet
```

For the **timeout flow**: skip step 12–13. Wait for ledger timeout (or set a 1-day timeout and wait). Seller clicks "Claim Payment" once it activates.

---

## 12. Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `"deal not found"` | Contract not deployed or wrong contract ID | Check `VITE_CONTRACT_ID_TESTNET` |
| `"Simulation failed"` | Wrong network passphrase or RPC URL | Ensure `.env.local` matches `VITE_STELLAR_NETWORK` |
| `"Freighter extension is not installed"` | Extension missing | Install from freighter.app |
| `"deal is not available for funding"` | Deal already funded | Buyer opened old link; reload to see current status |
| `"caller is not the registered buyer"` | Wrong wallet connected | Switch Freighter to the buyer account that originally funded |
| `"timeout has not yet passed"` | Seller clicked claim early | On-chain guard — wait for `timeout_ledger` to pass |
| CORS error on RPC | Vite dev server blocked | Add `allowHttp: true` for testnet in `client.ts` (already done) |
| BigInt JSON serialization error | Native JSON doesn't handle BigInt | Use `.toString()` before JSON.stringify; already handled in utils |

---

## 13. What's NOT in the Scaffold (Next Steps)

These are defined in the user stories but excluded from MVP scope or not yet implemented:

| Feature | User Story | Notes |
|---------|-----------|-------|
| Email/Phone OTP signup | US-009 | Requires backend (Auth service + Stellar keypair custody) |
| XLM on-ramp (GCash/Maya) | US-010 | Integrate Transak or Kado SDK |
| XLM off-ramp (GCash/bank) | US-011 | Integrate off-ramp partner API |
| Notifications (email/SMS) | FR-4.x | Requires backend webhook on Soroban events |
| Dashboard (my deals list) | FR-2.3 | Requires indexer or event log query |
| Wallet settings (switch) | US-012 AC | Settings page not scaffolded |
| Unit tests | — | Add Vitest + Testing Library |
| Mainnet deployment | NFR-4.3 | Set `VITE_STELLAR_NETWORK=mainnet` and fill mainnet IDs |

---

*SwapProof MVP · Built on Stellar Soroban · 2026*
