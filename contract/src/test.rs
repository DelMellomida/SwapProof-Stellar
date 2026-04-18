use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

use crate::{DealStatus, SwapProofContract, SwapProofContractClient};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// A fully wired test fixture: one Env, one contract, one USDC token.
/// All addresses are generated from the *same* env so auth works correctly.
struct Fixture {
    env: Env,
    client: SwapProofContractClient<'static>,
    usdc: Address,
    seller: Address,
    buyer: Address,
}

impl Fixture {
    fn new(escrow_amount: i128) -> Self {
        let env = Env::default();
        env.mock_all_auths();

        // All addresses must come from the same env instance
        let seller = Address::generate(&env);
        let buyer = Address::generate(&env);

        let contract_id = env.register_contract(None, SwapProofContract);
        let client = SwapProofContractClient::new(&env, &contract_id);

        let usdc_admin = Address::generate(&env);
        let usdc_token = env.register_stellar_asset_contract_v2(usdc_admin);
        let usdc = usdc_token.address();

        if escrow_amount > 0 {
            StellarAssetClient::new(&env, &usdc).mint(&buyer, &escrow_amount);
        }

        Fixture { env, client, usdc, seller, buyer }
    }

    fn token(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.usdc)
    }

    fn default_deal_id(&self) -> u64 { 1 }

    fn default_timeout(&self) -> u32 {
        self.env.ledger().sequence() + 1000
    }

    fn create_and_fund(&self, deal_id: u64, amount: i128, timeout: u32, item: &str) {
        self.client.create_deal(
            &deal_id, &self.seller, &amount, &timeout,
            &String::from_str(&self.env, item),
        );
        self.client.fund_deal(&deal_id, &self.buyer, &self.usdc);
    }
}

// ─── Test 1: Happy Path ────────────────────────────────────────────────────────
/// Full end-to-end MVP escrow: create → fund → confirm → seller receives USDC.
/// Maps to T-I-01, US-001 → US-003.
#[test]
fn test_happy_path_full_escrow_flow() {
    let f = Fixture::new(1_000_0000000);
    let amount = 1_000_0000000_i128;
    let deal_id = f.default_deal_id();
    let timeout = f.default_timeout();

    // Step 1: Seller creates deal — buyer is unassigned (None)
    f.client.create_deal(&deal_id, &f.seller, &amount, &timeout,
        &String::from_str(&f.env, "Samsung Galaxy S24"));

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::PendingPayment);
    assert!(d.buyer.is_none(), "buyer must be None before funding");

    // Step 2: Buyer locks funds — address is bound on-chain
    f.client.fund_deal(&deal_id, &f.buyer, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Funded);
    assert_eq!(d.buyer, Some(f.buyer.clone()));
    assert_eq!(f.token().balance(&f.buyer), 0, "buyer balance must be drained");

    // Step 3: Buyer confirms receipt — USDC released to seller
    f.client.confirm_receipt(&deal_id, &f.buyer, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Completed);
    assert_eq!(f.token().balance(&f.seller), amount, "seller must receive full escrow");
}

// ─── Test 2: Edge Case — Unauthorized caller ──────────────────────────────────
/// confirm_receipt() called by an impostor must panic with the correct message.
/// Maps to T-C-04, FR-1.3, NFR-2.4.
#[test]
#[should_panic(expected = "caller is not the registered buyer")]
fn test_confirm_receipt_rejected_for_non_buyer() {
    let f = Fixture::new(500_0000000);
    let impostor = Address::generate(&f.env); // same env — valid address, wrong role
    let deal_id = f.default_deal_id();

    f.create_and_fund(deal_id, 500_0000000, f.default_timeout(), "iPhone 15 Pro");

    // Impostor attempts to release funds — must be rejected
    f.client.confirm_receipt(&deal_id, &impostor, &f.usdc);
}

// ─── Test 3: State Verification ───────────────────────────────────────────────
/// Storage must reflect the correct DealStatus and buyer binding after each
/// state-changing call. Maps to T-C-09/10/11, FR-1.8.
#[test]
fn test_state_transitions_reflect_correct_storage() {
    let f = Fixture::new(200_0000000);
    let amount = 200_0000000_i128;
    let deal_id = f.default_deal_id();
    let timeout = f.default_timeout();

    f.client.create_deal(&deal_id, &f.seller, &amount, &timeout,
        &String::from_str(&f.env, "Dyson V15"));

    // ── After create_deal ──
    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.deal_id, deal_id);
    assert_eq!(d.seller, f.seller);
    assert!(d.buyer.is_none(),                       "buyer must be None before funding");
    assert_eq!(d.amount, amount);
    assert_eq!(d.timeout_ledger, timeout);
    assert_eq!(d.status, DealStatus::PendingPayment, "must be PendingPayment after create");

    // ── After fund_deal ──
    f.client.fund_deal(&deal_id, &f.buyer, &f.usdc);
    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Funded,         "must be Funded after fund_deal");
    assert_eq!(d.buyer, Some(f.buyer.clone()),        "buyer address must be bound on-chain");

    // ── After confirm_receipt ──
    f.client.confirm_receipt(&deal_id, &f.buyer, &f.usdc);
    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Completed,      "must be Completed after confirm_receipt");

    assert_eq!(f.token().balance(&f.seller), amount, "seller must hold escrow funds");
    assert_eq!(f.token().balance(&f.buyer), 0,       "buyer balance must be zero");
}

// ─── Test 4: Timeout Claim ────────────────────────────────────────────────────
/// Seller claims funds after timeout_ledger passes; deal becomes TimedOut.
/// Maps to T-C-05, US-004, FR-1.4.
#[test]
fn test_seller_can_claim_after_timeout() {
    let f = Fixture::new(750_0000000);
    let amount = 750_0000000_i128;
    let deal_id = f.default_deal_id();
    let timeout = f.env.ledger().sequence() + 5; // short timeout for test

    f.create_and_fund(deal_id, amount, timeout, "PlayStation 5");

    // Advance ledger past the timeout window
    f.env.ledger().set(LedgerInfo {
        sequence_number: timeout + 1,
        timestamp: 9999,
        protocol_version: 21,
        network_id: [0u8; 32],
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6312000,
    });

    f.client.claim_timeout(&deal_id, &f.seller, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::TimedOut,       "status must be TimedOut");
    assert_eq!(f.token().balance(&f.seller), amount, "seller must receive funds on timeout");
}

// ─── Test 5: Duplicate Deal ID Rejected ───────────────────────────────────────
/// create_deal() with a deal_id that already exists must panic.
/// Prevents overwriting an active escrow. Maps to T-C-01, FR-1.6.
#[test]
#[should_panic(expected = "deal already exists")]
fn test_duplicate_deal_id_rejected() {
    let f = Fixture::new(100_0000000);
    let deal_id = f.default_deal_id();
    let timeout = f.default_timeout();
    let amount = 100_0000000_i128;

    f.client.create_deal(&deal_id, &f.seller, &amount, &timeout,
        &String::from_str(&f.env, "MacBook Air M3"));

    // Second call with same deal_id must panic
    f.client.create_deal(&deal_id, &f.seller, &amount, &timeout,
        &String::from_str(&f.env, "Duplicate Attempt"));
}