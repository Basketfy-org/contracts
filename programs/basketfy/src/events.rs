
// events.rs
use anchor_lang::prelude::*;

#[event]
pub struct FactoryInitializedEvent
{
    pub baskets:u64,
    pub admin: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct BasketCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub created_at: i64,
    pub token_mints: Vec<Pubkey>,
    pub weights: Vec<u64>,
}

#[event]
pub struct TokensBurnedEvent {
   pub from: Pubkey,
   pub amount:u64,
   pub owner:Pubkey
}

#[event]
pub struct TokensTransferredEvent {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

#[event]
pub struct TokensMintedEvent {
    pub mint: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}