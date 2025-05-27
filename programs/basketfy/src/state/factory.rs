// src/state/factory.rs
use anchor_lang::prelude::*;


#[account]
pub struct FactoryState {
    pub authority: Pubkey,
    pub basket_count: u64,
    pub bump: u8,
}

impl FactoryState {
    pub const LEN: usize = 32 + 8 + 1;
}