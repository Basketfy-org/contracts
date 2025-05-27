//src/instructions/factory.rs
use anchor_lang::prelude::*;

use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"factory"],
        bump,
        space = 8 + FactoryState::LEN,
    )]
    pub factory: Account<'info, FactoryState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeFactory>) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    factory.bump = ctx.bumps.factory;
    factory.authority = ctx.accounts.payer.key(); // Initialize authority field
    factory.basket_count = 0;

    emit!(FactoryInitializedEvent {
        baskets: factory.basket_count,
        admin: ctx.accounts.payer.key(),
       created_at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
