//src/instructions/transfer.rs
use crate::events::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct TransferBToken<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        address = from.mint
    )]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<TransferBToken>, amount: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    let result = transfer(cpi_ctx, amount);
    if let Err(e) = result {
        return Err(e.into());
    }

    emit!(TokensTransferredEvent {
        from: ctx.accounts.from.key(),
        to: ctx.accounts.to.key(),
        amount,
    });
    Ok(())
}
