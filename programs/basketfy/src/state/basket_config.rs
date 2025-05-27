// src/state/basket.rs - 
use anchor_lang::prelude::*;

#[account]
pub struct BasketConfig {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub uri: String,
    pub created_at: i64,
    pub token_mints: Vec<Pubkey>, // token addresses
    pub weights: Vec<u64>,        // corresponding weights
}

pub const MAX_TOKENS: usize = 10;
pub const MAX_NAME_LENGTH: usize = 200;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;

impl BasketConfig {
    pub const LEN: usize = 
        32 +  // mint
        32 +  // creator
        (4 + MAX_NAME_LENGTH) + // name (4 bytes for length + max content)
        (4 + MAX_SYMBOL_LENGTH) + // symbol (4 bytes for length + max content)
        1 + // decimals
        (4 + MAX_URI_LENGTH) + // uri (4 bytes for length + max content)
        8 +  // created_at
        (4 + MAX_TOKENS * 32) + // token_mints (4 bytes for vec length + content)
        (4 + MAX_TOKENS * 8); // weights (4 bytes for vec length + content)
}