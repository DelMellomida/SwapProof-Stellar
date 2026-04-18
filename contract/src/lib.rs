#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

/// Top-level key namespace for storing Deal structs in persistent storage.
/// Each deal is stored as DataKey::Deal(deal_id).
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Deal(u64),
}

// ─── Domain Types ────────────────────────────────────────────────────────────

/// Represents all possible states a deal can be in throughout its lifecycle.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum DealStatus {
    /// Seller has created the deal; waiting for a buyer to lock funds.
    PendingPayment,
    /// Buyer has locked funds in escrow; awaiting buyer confirmation or timeout.
    Funded,
    /// Buyer confirmed receipt — USDC released to seller. Terminal state.
    Completed,
    /// Timeout elapsed without buyer confirmation — USDC claimed by seller. Terminal state.
    TimedOut,
}

/// The on-chain record for a single escrow deal.
/// Stored in persistent contract storage keyed by deal_id.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Deal {
    /// Unique numeric identifier for this deal.
    pub deal_id: u64,
    /// Seller's Stellar address — only they can call claim_timeout().
    pub seller: Address,
    /// Buyer's Stellar address — set at fund time; None until funded.
    /// Using Option<Address> to represent "not yet bound".
    pub buyer: Option<Address>,
    /// Escrow amount in the smallest USDC unit (stroops-equivalent / 7 decimals).
    pub amount: i128,
    /// Stellar ledger sequence number after which the seller may claim timeout.
    pub timeout_ledger: u32,
    /// Human-readable item description stored on-chain for auditability.
    pub item_name: String,
    /// Current lifecycle state of the deal.
    pub status: DealStatus,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct SwapProofContract;

#[contractimpl]
impl SwapProofContract {
    /// **create_deal** — Called by the Seller to register a new escrow deal.
    ///
    /// The buyer is intentionally unassigned at creation time; they are bound
    /// on-chain only when they lock funds via fund_deal(). This lets the seller
    /// create a deal and share its link *before* knowing the buyer's address.
    ///
    /// Emits: event `("deal", "created", deal_id)`
    ///
    /// Errors if a deal with deal_id already exists (FR-1.6).
    pub fn create_deal(
        env: Env,
        deal_id: u64,
        seller: Address,
        amount: i128,
        timeout_ledger: u32,
        item_name: String,
    ) {
        // Require the caller to be the seller — prevents impersonation.
        seller.require_auth();

        // Reject duplicate deal IDs — storage must not be overwritten (FR-1.6).
        let key = DataKey::Deal(deal_id);
        if env.storage().persistent().has(&key) {
            panic!("deal already exists");
        }

        // Validate amount is positive — a zero-value escrow is meaningless.
        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Validate timeout is in the future relative to the current ledger.
        if timeout_ledger <= env.ledger().sequence() {
            panic!("timeout_ledger must be in the future");
        }

        // Build and persist the deal record.
        let deal = Deal {
            deal_id,
            seller: seller.clone(),
            buyer: None, // Buyer is unassigned until fund_deal() is called.
            amount,
            timeout_ledger,
            item_name,
            status: DealStatus::PendingPayment,
        };

        env.storage().persistent().set(&key, &deal);

        // Emit an event so off-chain indexers and the frontend can react.
        // topic = ("deal", "created"), data = deal_id
        env.events().publish(
            (symbol_short!("deal"), symbol_short!("created")),
            deal_id,
        );
    }

    /// **fund_deal** — Called by the Buyer to lock USDC into the contract.
    ///
    /// This is the moment the buyer becomes bound on-chain. Their address is
    /// written to the deal record and is the *only* address allowed to later
    /// call confirm_receipt().
    ///
    /// Transfers `amount` USDC from buyer → contract.
    /// Emits: event `("deal", "funded", deal_id)`
    ///
    /// Errors if deal doesn't exist, is not PENDING_PAYMENT, or token transfer fails.
    pub fn fund_deal(
        env: Env,
        deal_id: u64,
        buyer: Address,
        usdc_token: Address,
    ) {
        // Require the caller to be the buyer — they must sign the transaction.
        buyer.require_auth();

        let key = DataKey::Deal(deal_id);

        // Load deal or panic — buyers should not be able to fund ghost deals.
        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        // Only PENDING_PAYMENT deals can be funded (FR-1.2).
        if deal.status != DealStatus::PendingPayment {
            panic!("deal is not available for funding");
        }

        // Transfer USDC from buyer to *this* contract using the token interface.
        // soroban_sdk::token::Client wraps the Stellar SAC (Soroban Asset Contract).
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &buyer,
            &env.current_contract_address(),
            &deal.amount,
        );

        // Bind buyer on-chain — this is the authoritative record of who funded.
        deal.buyer = Some(buyer);
        deal.status = DealStatus::Funded;

        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("funded")),
            deal_id,
        );
    }

    /// **confirm_receipt** — Called by the Buyer to release funds to the Seller.
    ///
    /// Only the wallet address that funded the deal (bound at fund_deal time)
    /// may call this. Transfers USDC from contract → seller and permanently
    /// closes the deal as COMPLETED (FR-1.3, NFR-2.4).
    ///
    /// Emits: event `("deal", "completed", deal_id)`
    pub fn confirm_receipt(
        env: Env,
        deal_id: u64,
        buyer: Address,
        usdc_token: Address,
    ) {
        // The caller must prove they are the buyer (wallet signature required).
        buyer.require_auth();

        let key = DataKey::Deal(deal_id);

        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        // Guard: deal must be in FUNDED state — not already completed or timed out.
        if deal.status != DealStatus::Funded {
            panic!("deal is not in funded state");
        }

        // Guard: the caller must be the exact buyer address bound at fund time (NFR-2.4).
        let registered_buyer = deal.buyer.clone().expect("no buyer on record");
        if registered_buyer != buyer {
            panic!("caller is not the registered buyer");
        }

        // Release USDC from contract → seller.
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &deal.seller,
            &deal.amount,
        );

        // Mark deal terminal — no further fund operations are possible (FR-1.7).
        deal.status = DealStatus::Completed;
        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("completed")),
            deal_id,
        );
    }

    /// **claim_timeout** — Called by the Seller after the timeout window expires.
    ///
    /// This is the "ghost buyer" protection: if the buyer never confirms receipt,
    /// the seller can reclaim funds once the agreed ledger is passed.
    ///
    /// Timeout always resolves in the seller's favor — there is no dispute
    /// mechanism in the MVP (FR-1.4). On-chain enforcement means the seller
    /// cannot claim a single ledger early (US-004 AC).
    ///
    /// Emits: event `("deal", "timedout", deal_id)`
    pub fn claim_timeout(
        env: Env,
        deal_id: u64,
        seller: Address,
        usdc_token: Address,
    ) {
        // Seller must sign the transaction.
        seller.require_auth();

        let key = DataKey::Deal(deal_id);

        let mut deal: Deal = env
            .storage()
            .persistent()
            .get(&key)
            .expect("deal not found");

        // Guard: only the original seller may claim (NFR-2.4).
        if deal.seller != seller {
            panic!("caller is not the seller");
        }

        // Guard: deal must be FUNDED — not already terminal (FR-1.7).
        if deal.status != DealStatus::Funded {
            panic!("deal is not in funded state");
        }

        // Guard: enforce timeout on-chain — seller cannot claim early (FR-1.4).
        if env.ledger().sequence() <= deal.timeout_ledger {
            panic!("timeout has not yet passed");
        }

        // Release USDC from contract → seller.
        let token_client = token::Client::new(&env, &usdc_token);
        token_client.transfer(
            &env.current_contract_address(),
            &deal.seller,
            &deal.amount,
        );

        // Mark deal terminal as TIMED_OUT — distinct from COMPLETED for auditability.
        deal.status = DealStatus::TimedOut;
        env.storage().persistent().set(&key, &deal);

        env.events().publish(
            (symbol_short!("deal"), symbol_short!("timedout")),
            deal_id,
        );
    }

    /// **get_deal** — Public read-only view of a deal's full state.
    ///
    /// Returns the entire Deal struct so the frontend and any off-chain indexer
    /// can reconstruct current status without trusting a database cache.
    /// This is the contract's source-of-truth endpoint (FR-1.5, FR-1.8, FR-2.3).
    ///
    /// Panics if the deal_id is not found.
    pub fn get_deal(env: Env, deal_id: u64) -> Deal {
        let key = DataKey::Deal(deal_id);
        env.storage()
            .persistent()
            .get(&key)
            .expect("deal not found")
    }
}

// Tells Rust to compile and include src/test.rs as a submodule.
// Without this declaration, `cargo test` never sees the test file.
#[cfg(test)]
mod test;