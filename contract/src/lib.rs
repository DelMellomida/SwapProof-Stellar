#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Deal(u64),
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum DealStatus {
    PendingPayment,
    FundedAwaitingShipment,
    ShippedAwaitingReceipt,
    Completed,
    Refunded,
    SellerClaimed,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Deal {
    pub deal_id: u64,
    pub seller: Address,
    pub buyer: Option<Address>,
    pub escrow_token: Option<Address>,
    pub amount: i128,
    pub ship_deadline_ledger: u32,
    pub buyer_confirm_window_ledgers: u32,
    pub buyer_confirm_deadline_ledger: Option<u32>,
    pub shipped_at_ledger: Option<u32>,
    pub item_name: String,
    pub status: DealStatus,
}

#[contract]
pub struct SwapProofContract;

#[contractimpl]
impl SwapProofContract {
    pub fn create_deal(
        env: Env,
        deal_id: u64,
        seller: Address,
        amount: i128,
        ship_deadline_ledger: u32,
        buyer_confirm_window_ledgers: u32,
        item_name: String,
    ) {
        seller.require_auth();

        let key = DataKey::Deal(deal_id);
        if env.storage().persistent().has(&key) {
            panic!("deal already exists");
        }

        if amount <= 0 {
            panic!("amount must be positive");
        }

        if ship_deadline_ledger <= env.ledger().sequence() {
            panic!("ship_deadline_ledger must be in the future");
        }

        if buyer_confirm_window_ledgers == 0 {
            panic!("buyer_confirm_window_ledgers must be positive");
        }

        let deal = Deal {
            deal_id,
            seller: seller.clone(),
            buyer: None,
            escrow_token: None,
            amount,
            ship_deadline_ledger,
            buyer_confirm_window_ledgers,
            buyer_confirm_deadline_ledger: None,
            shipped_at_ledger: None,
            item_name,
            status: DealStatus::PendingPayment,
        };

        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("created")),
            deal_id,
        );
    }

    pub fn fund_deal(
        env: Env,
        deal_id: u64,
        buyer: Address,
        token_address: Address,
    ) {
        buyer.require_auth();

        let key = DataKey::Deal(deal_id);
        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        if deal.status != DealStatus::PendingPayment {
            panic!("deal is not available for funding");
        }

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &buyer,
            &env.current_contract_address(),
            &deal.amount,
        );

        deal.buyer = Some(buyer);
        deal.escrow_token = Some(token_address);
        deal.status = DealStatus::FundedAwaitingShipment;

        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("funded")),
            deal_id,
        );
    }

    pub fn mark_shipped(
        env: Env,
        deal_id: u64,
        seller: Address,
    ) {
        seller.require_auth();

        let key = DataKey::Deal(deal_id);
        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        if deal.seller != seller {
            panic!("caller is not the seller");
        }

        if deal.status != DealStatus::FundedAwaitingShipment {
            panic!("deal is not awaiting shipment");
        }

        if env.ledger().sequence() > deal.ship_deadline_ledger {
            panic!("shipping deadline has passed");
        }

        let shipped_at_ledger = env.ledger().sequence();
        let buyer_confirm_deadline_ledger = shipped_at_ledger
            .checked_add(deal.buyer_confirm_window_ledgers)
            .expect("buyer confirm deadline overflow");

        deal.shipped_at_ledger = Some(shipped_at_ledger);
        deal.buyer_confirm_deadline_ledger = Some(buyer_confirm_deadline_ledger);
        deal.status = DealStatus::ShippedAwaitingReceipt;

        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("shipped")),
            deal_id,
        );
    }

    pub fn confirm_receipt(
        env: Env,
        deal_id: u64,
        buyer: Address,
    ) {
        buyer.require_auth();

        let key = DataKey::Deal(deal_id);

        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        if deal.status != DealStatus::ShippedAwaitingReceipt {
            panic!("deal is not awaiting buyer receipt confirmation");
        }

        let registered_buyer = deal.buyer.clone().expect("no buyer on record");
        if registered_buyer != buyer {
            panic!("caller is not the registered buyer");
        }

        let escrow_token = deal
            .escrow_token
            .clone()
            .expect("escrow token not set");
        let token_client = token::Client::new(&env, &escrow_token);
        token_client.transfer(
            &env.current_contract_address(),
            &deal.seller,
            &deal.amount,
        );

        deal.status = DealStatus::Completed;
        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("complete")),
            deal_id,
        );
    }

    pub fn claim_refund(
        env: Env,
        deal_id: u64,
        buyer: Address,
    ) {
        buyer.require_auth();

        let key = DataKey::Deal(deal_id);

        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        if deal.status != DealStatus::FundedAwaitingShipment {
            panic!("deal is not eligible for refund");
        }

        let registered_buyer = deal.buyer.clone().expect("no buyer on record");
        if registered_buyer != buyer {
            panic!("caller is not the registered buyer");
        }

        if env.ledger().sequence() <= deal.ship_deadline_ledger {
            panic!("shipping deadline has not yet passed");
        }

        let escrow_token = deal
            .escrow_token
            .clone()
            .expect("escrow token not set");
        let token_client = token::Client::new(&env, &escrow_token);
        token_client.transfer(
            &env.current_contract_address(),
            &buyer,
            &deal.amount,
        );

        deal.status = DealStatus::Refunded;
        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("refund")),
            deal_id,
        );
    }

    pub fn claim_seller_timeout(
        env: Env,
        deal_id: u64,
        seller: Address,
    ) {
        seller.require_auth();

        let key = DataKey::Deal(deal_id);

        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        if deal.seller != seller {
            panic!("caller is not the seller");
        }

        if deal.status != DealStatus::ShippedAwaitingReceipt {
            panic!("deal is not awaiting buyer receipt confirmation");
        }

        let buyer_confirm_deadline_ledger = deal
            .buyer_confirm_deadline_ledger
            .expect("buyer confirm deadline not set");

        if env.ledger().sequence() <= buyer_confirm_deadline_ledger {
            panic!("buyer confirmation deadline has not yet passed");
        }

        let escrow_token = deal
            .escrow_token
            .clone()
            .expect("escrow token not set");
        let token_client = token::Client::new(&env, &escrow_token);
        token_client.transfer(
            &env.current_contract_address(),
            &deal.seller,
            &deal.amount,
        );

        deal.status = DealStatus::SellerClaimed;
        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("sellerclm")),
            deal_id,
        );
    }

    pub fn get_deal(env: Env, deal_id: u64) -> Deal {
        let key = DataKey::Deal(deal_id);
        env.storage()
            .persistent()
            .get(&key)
            .expect("deal not found")
    }
}

#[cfg(test)]
mod test;
