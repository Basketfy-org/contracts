// instructions/burn.rs

use crate::events::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, Burn, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct BurnBToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub config: Account<'info, BasketConfig>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BurnBToken>, amount: u64) -> Result<()> {
    let user_token_account = ctx.accounts.user_token_account.to_account_info();
    let mint = ctx.accounts.mint.to_account_info();
    let owner = ctx.accounts.user.to_account_info();
    let token_program = ctx.accounts.token_program.to_account_info();

    // Burn tokens
    let cpi_accounts = Burn {
        mint,
        from: user_token_account,
        authority: owner,
    };

    let cpi_ctx = CpiContext::new(token_program, cpi_accounts);

    burn(cpi_ctx, amount)?;

    // Emit burn event
    emit!(TokensBurnedEvent {
        from: ctx.accounts.user_token_account.key(),
        amount,
        owner: ctx.accounts.user.key(),
    });

    Ok(())
}
