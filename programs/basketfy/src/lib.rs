// lib.rs
use anchor_lang::prelude::*;

mod errors;
mod events;
mod state;
mod instructions;

use instructions::*;

declare_id!("5PhybSd1vd9RaBjQ8R2cdf5mz2ogemo82RR2gajEGKTg");

#[program]
pub mod basketfy {
    use super::*;

    pub fn initialize(ctx: Context<InitializeFactory>) -> Result<()> {
        instructions::factory::handler(ctx)
    }

    pub fn create_basket(
        ctx: Context<CreateBTokenMint>,
        token_name: String,
        token_symbol: String,
        token_uri: String,
        token_decimals: u8,
        token_mints: Vec<Pubkey>,    // Fixed: mints before weights
        weights: Vec<u64>,          // Fixed: renamed to match handler
    ) -> Result<()> {
        instructions::basket::handler(ctx, token_name, token_symbol, token_uri, token_decimals, token_mints, weights)
    }

    pub fn mint_basket_token(ctx: Context<MintBToken>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }
    pub fn burn_basket_token(ctx: Context<BurnBToken>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }
    pub fn transfer_basket_token(ctx: Context<TransferBToken>, amount: u64) -> Result<()> {
        instructions::transfer::handler(ctx, amount)
    }
}
