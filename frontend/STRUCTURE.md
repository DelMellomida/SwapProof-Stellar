# SwapProof Frontend — Project Structure

swapproof-frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   └── logo.svg
│   ├── components/
│   │   ├── ui/                          # shadcn/ui primitives (auto-generated)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx             # Root layout wrapper
│   │   │   ├── Navbar.tsx               # Top nav with wallet connect
│   │   │   └── Footer.tsx
│   │   ├── deal/
│   │   │   ├── CreateDealForm.tsx       # US-001 — Seller creates deal
│   │   │   ├── DealCard.tsx             # Reusable deal summary card
│   │   │   ├── DealStatusBadge.tsx      # PENDING / FUNDED / COMPLETED / TIMEDOUT
│   │   │   ├── FundDealPanel.tsx        # US-002 — Buyer locks funds
│   │   │   ├── ConfirmReceiptButton.tsx # US-003 — Buyer confirms receipt
│   │   │   ├── ClaimTimeoutButton.tsx   # US-004 — Seller claims after timeout
│   │   │   ├── DealTimerCountdown.tsx   # FR-2.6 — Human-readable countdown
│   │   │   └── ShareDealLink.tsx        # US-006 — Copy link button
│   │   ├── wallet/
│   │   │   ├── ConnectWalletButton.tsx  # US-012 — Freighter connect
│   │   │   ├── WalletInfo.tsx           # Shows shortened address + balance
│   │   │   └── WalletGuard.tsx          # HOC — requires wallet to proceed
│   │   └── auth/
│   │       ├── OtpSignupModal.tsx       # US-009 — Email/phone OTP (Pillar 3)
│   │       └── AuthGuard.tsx            # Route protection wrapper
│   ├── pages/
│   │   ├── HomePage.tsx                 # Landing / hero
│   │   ├── CreateDealPage.tsx           # Seller deal creation (US-001)
│   │   ├── DealPage.tsx                 # /deal/:dealId — public deal view (US-005, US-007, US-008)
│   │   ├── DashboardPage.tsx            # Buyer/Seller deal list
│   │   └── NotFoundPage.tsx
│   ├── hooks/
│   │   ├── useFreighter.ts              # Freighter wallet state & auth
│   │   ├── useDeal.ts                   # Fetch deal from Soroban RPC
│   │   ├── useCreateDeal.ts             # Invoke create_deal()
│   │   ├── useFundDeal.ts               # Invoke fund_deal()
│   │   ├── useConfirmReceipt.ts         # Invoke confirm_receipt()
│   │   └── useClaimTimeout.ts           # Invoke claim_timeout()
│   ├── lib/
│   │   ├── soroban/
│   │   │   ├── client.ts                # Soroban RPC client setup
│   │   │   ├── contract.ts              # Contract ID constants + ABI helpers
│   │   │   └── types.ts                 # Deal, DealStatus TypeScript types
│   │   ├── stellar/
│   │   │   └── freighter.ts             # Freighter SDK wrapper
│   │   └── utils.ts                     # formatUSDC, formatAddress, etc.
│   ├── store/
│   │   └── walletStore.ts               # Zustand — wallet address, network, balance
│   ├── router/
│   │   └── index.tsx                    # React Router v6 routes
│   ├── styles/
│   │   └── globals.css                  # Tailwind base + CSS variables
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── .env.local                           # (gitignored)
├── components.json                      # shadcn/ui config
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
