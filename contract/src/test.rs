use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

use crate::{DealStatus, SwapProofContract, SwapProofContractClient};

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

    fn ship_deadline(&self) -> u32 {
        self.env.ledger().sequence() + 5
    }

    fn buyer_confirm_window(&self) -> u32 {
        10
    }

    fn create_deal(&self, deal_id: u64, amount: i128, ship_deadline: u32, buyer_confirm_window: u32, item: &str) {
        self.client.create_deal(
            &deal_id,
            &self.seller,
            &amount,
            &ship_deadline,
            &buyer_confirm_window,
            &String::from_str(&self.env, item),
        );
    }

    fn create_and_fund(&self, deal_id: u64, amount: i128, ship_deadline: u32, buyer_confirm_window: u32, item: &str) {
        self.create_deal(deal_id, amount, ship_deadline, buyer_confirm_window, item);
        self.client.fund_deal(&deal_id, &self.buyer, &self.usdc);
    }

    fn set_ledger(&self, sequence: u32) {
        self.env.ledger().set(LedgerInfo {
            sequence_number: sequence,
            timestamp: sequence as u64,
            protocol_version: 21,
            network_id: [0u8; 32],
            base_reserve: 5_000_000,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 4096,
            max_entry_ttl: 6312000,
        });
    }
}

#[test]
fn test_happy_path_ship_then_confirm() {
    let f = Fixture::new(1_000_0000000);
    let amount = 1_000_0000000_i128;
    let deal_id = f.default_deal_id();
    let ship_deadline = f.ship_deadline();
    let buyer_confirm_window = f.buyer_confirm_window();

    f.create_deal(deal_id, amount, ship_deadline, buyer_confirm_window, "Samsung Galaxy S24");

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::PendingPayment);
    assert!(d.buyer.is_none());
    assert!(d.shipped_at_ledger.is_none());
    assert!(d.buyer_confirm_deadline_ledger.is_none());

    f.client.fund_deal(&deal_id, &f.buyer, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::FundedAwaitingShipment);
    assert_eq!(d.buyer, Some(f.buyer.clone()));
    assert_eq!(f.token().balance(&f.buyer), 0);

    f.client.mark_shipped(&deal_id, &f.seller);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::ShippedAwaitingReceipt);
    assert_eq!(d.shipped_at_ledger, Some(f.env.ledger().sequence()));
    assert_eq!(
        d.buyer_confirm_deadline_ledger,
        Some(f.env.ledger().sequence() + buyer_confirm_window),
    );

    f.client.confirm_receipt(&deal_id, &f.buyer, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Completed);
    assert_eq!(f.token().balance(&f.seller), amount);
}

#[test]
fn test_buyer_can_refund_after_missed_shipping_deadline() {
    let f = Fixture::new(750_0000000);
    let amount = 750_0000000_i128;
    let deal_id = f.default_deal_id();
    let ship_deadline = f.ship_deadline();

    f.create_and_fund(
        deal_id,
        amount,
        ship_deadline,
        f.buyer_confirm_window(),
        "PlayStation 5",
    );

    f.set_ledger(ship_deadline + 1);

    f.client.claim_refund(&deal_id, &f.buyer, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::Refunded);
    assert_eq!(f.token().balance(&f.buyer), amount);
    assert_eq!(f.token().balance(&f.seller), 0);
}

#[test]
fn test_seller_can_claim_after_shipping_and_buyer_inactivity() {
    let f = Fixture::new(800_0000000);
    let amount = 800_0000000_i128;
    let deal_id = f.default_deal_id();
    let ship_deadline = f.ship_deadline();
    let buyer_confirm_window = f.buyer_confirm_window();

    f.create_and_fund(
        deal_id,
        amount,
        ship_deadline,
        buyer_confirm_window,
        "Nintendo Switch OLED",
    );

    f.client.mark_shipped(&deal_id, &f.seller);

    let confirm_deadline = f
        .client
        .get_deal(&deal_id)
        .buyer_confirm_deadline_ledger
        .expect("deadline should be set after shipment");

    f.set_ledger(confirm_deadline + 1);
    f.client.claim_seller_timeout(&deal_id, &f.seller, &f.usdc);

    let d = f.client.get_deal(&deal_id);
    assert_eq!(d.status, DealStatus::SellerClaimed);
    assert_eq!(f.token().balance(&f.seller), amount);
}

#[test]
#[should_panic(expected = "caller is not the registered buyer")]
fn test_confirm_receipt_rejected_for_non_buyer() {
    let f = Fixture::new(500_0000000);
    let impostor = Address::generate(&f.env);

    f.create_and_fund(
        f.default_deal_id(),
        500_0000000,
        f.ship_deadline(),
        f.buyer_confirm_window(),
        "iPhone 15 Pro",
    );
    f.client.mark_shipped(&f.default_deal_id(), &f.seller);

    f.client.confirm_receipt(&f.default_deal_id(), &impostor, &f.usdc);
}

#[test]
#[should_panic(expected = "caller is not the seller")]
fn test_non_seller_cannot_mark_shipped() {
    let f = Fixture::new(300_0000000);

    f.create_and_fund(
        f.default_deal_id(),
        300_0000000,
        f.ship_deadline(),
        f.buyer_confirm_window(),
        "Dyson V15",
    );

    f.client.mark_shipped(&f.default_deal_id(), &f.buyer);
}

#[test]
#[should_panic(expected = "shipping deadline has not yet passed")]
fn test_refund_rejected_before_shipping_deadline() {
    let f = Fixture::new(400_0000000);

    f.create_and_fund(
        f.default_deal_id(),
        400_0000000,
        f.ship_deadline(),
        f.buyer_confirm_window(),
        "MacBook Air M3",
    );

    f.client.claim_refund(&f.default_deal_id(), &f.buyer, &f.usdc);
}

#[test]
#[should_panic(expected = "buyer confirmation deadline has not yet passed")]
fn test_seller_claim_rejected_before_confirm_deadline() {
    let f = Fixture::new(450_0000000);

    f.create_and_fund(
        f.default_deal_id(),
        450_0000000,
        f.ship_deadline(),
        f.buyer_confirm_window(),
        "Bose QC Ultra",
    );
    f.client.mark_shipped(&f.default_deal_id(), &f.seller);

    f.client.claim_seller_timeout(&f.default_deal_id(), &f.seller, &f.usdc);
}

#[test]
#[should_panic(expected = "deal already exists")]
fn test_duplicate_deal_id_rejected() {
    let f = Fixture::new(100_0000000);
    let deal_id = f.default_deal_id();
    let ship_deadline = f.ship_deadline();
    let amount = 100_0000000_i128;

    f.create_deal(
        deal_id,
        amount,
        ship_deadline,
        f.buyer_confirm_window(),
        "MacBook Air M3",
    );

    f.create_deal(
        deal_id,
        amount,
        ship_deadline,
        f.buyer_confirm_window(),
        "Duplicate Attempt",
    );
}
