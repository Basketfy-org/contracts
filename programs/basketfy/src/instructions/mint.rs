//src/instructions/mint.rs

use crate::events::*;
use crate::state::*;
use crate::errors::CustomError;
use anchor_lang::prelude::*;
use anchor_spl::token::{ Mint, MintTo, Token,mint_to, TokenAccount};

#[derive(Accounts)]
pub struct MintBToken<'info> {
    #[account(mut)]
    pub config: Account<'info, BasketConfig>,

    /// CHECK: This account is used as a mint authority and is validated through program logic
    #[account(
        seeds = [b"mint-authority", config.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,

    constraint = mint.key() == config.mint @ CustomError::InvalidMint
    )
    ]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = recipient_token_account.mint == config.mint @ CustomError::InvalidTokenAccount
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<MintBToken>, amount: u64) -> Result<()> {
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };
    let binding = ctx.accounts.config.key();
    let seeds = &[
        b"mint-authority",
        binding.as_ref(),
        &[ctx.bumps.mint_authority],
    ];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );

    mint_to(cpi_ctx, amount)?;

    // Emit minting event
    emit!(TokensMintedEvent {
        mint: ctx.accounts.mint.key(),
        to: ctx.accounts.recipient_token_account.owner,
        amount,
    });

    Ok(())
}
