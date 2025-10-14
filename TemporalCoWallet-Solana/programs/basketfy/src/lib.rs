#![allow(clippy::result_large_err)]
use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Burn, Mint, MintTo, Token, TokenAccount}
};

declare_id!("5PhybSd1vd9RaBjQ8R2cdf5mz2ogemo82RR2gajEGKTg");

#[program]
pub mod basketfy {
    use super::*;

    /// Initialize the basket factory
    pub fn initialize_factory(ctx: Context<InitializeFactory>) -> Result<()> {
        let factory = &mut ctx.accounts.factory;
        factory.authority = ctx.accounts.authority.key();
        factory.total_baskets = 0;
        factory.bump = ctx.bumps.factory;

        msg!(
            "Basket factory initialized with authority: {}",
            factory.authority
        );
        Ok(())
    }

    pub fn update_fee(ctx: Context<UpdateFee>, new_fee_bps: u16) -> Result<()> {
        require!(new_fee_bps <= 1000, BasketError::FeeTooHigh); // Max 10%
        ctx.accounts.basket.fee_bps = new_fee_bps;
        Ok(())
    }

    // Create a new basket with tokens and weights
    pub fn create_basket(
        ctx: Context<CreateBasket>,
        name: String,
        symbol: String,
        _decimals: u8,
        description: String,
        tokens: Vec<Pubkey>,
        weights: Vec<u8>,
    ) -> Result<()> {
        require!(
            tokens.len() == weights.len() && tokens.len() > 0,
            BasketError::InvalidInput
        );
        require!(tokens.len() <= 10, BasketError::TooManyTokens);
        
        let total_weight: u64 = weights.iter().map(|w| *w as u64).sum();
        require!(total_weight == 100, BasketError::InvalidWeights);

        let basket = &mut ctx.accounts.basket;
        basket.payer = *ctx.accounts.payer.key;
        basket.name = name;
        basket.description = description;
        basket.symbol = symbol;
        
        // Convert Vec to fixed arrays
        let mut token_array = [Pubkey::default(); 10];
        let mut weight_array = [0u8; 10];
        
        for (i, token) in tokens.iter().enumerate() {
            token_array[i] = *token;
        }
        for (i, weight) in weights.iter().enumerate() {
            weight_array[i] = *weight;
        }
        
        basket.tokens = token_array;
        basket.weights = weight_array;
        basket.token_count = tokens.len() as u8;
        basket.total_weight = total_weight;
        basket.fee_bps = 0;
        
        Ok(())
    }

    // Mint basket tokens (simplified stub)
    pub fn mint_basket_tokens(ctx: Context<MintBasketTokens>, amount: u64) -> Result<()> {
        let basket = &ctx.accounts.basket;
        let user_balance = ctx.accounts.user_usdc_account.amount;

        let fee = amount * basket.fee_bps as u64 / 10_000;
        let total_required = amount + fee;

        require!(
            user_balance >= total_required,
            BasketError::InsufficientUsdc
        );

        // Transfer USDC (incl. fee) from user to vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_usdc_account.to_account_info(),
                to: ctx.accounts.basket_usdc_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, total_required)?;

        // Mint basket tokens to user
        let seeds: &[&[u8]] = &[b"basket_authority", &[ctx.bumps.basket_authority]];
        let signer = &[seeds];
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.basket_mint.to_account_info(),
                to: ctx.accounts.user_basket_token_account.to_account_info(),
                authority: ctx.accounts.basket_authority.to_account_info(),
            },
            signer,
        );
        token::mint_to(mint_ctx, amount)?;

        Ok(())
    }

    // Redeem basket tokens for underlying tokens (simplified stub)
    pub fn redeem_basket_tokens(ctx: Context<RedeemBasketTokens>, amount: u64) -> Result<()> {
        // Burn basket tokens
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.basket_mint.to_account_info(),
                from: ctx.accounts.user_basket_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::burn(burn_ctx, amount)?;

        // Compute fee and amount to return
        let basket = &ctx.accounts.basket;
        let fee = amount * basket.fee_bps as u64 / 10_000;
        let net_amount = amount.checked_sub(fee).ok_or(BasketError::MathError)?;

        // Transfer USDC from vault to user (net)
        let seeds: &[&[u8]] = &[b"basket_authority", &[ctx.bumps.basket_authority]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.basket_usdc_vault.to_account_info(),
                to: ctx.accounts.user_usdc_account.to_account_info(),
                authority: ctx.accounts.basket_authority.to_account_info(),
            },
            signer,
        );

        token::transfer(transfer_ctx, net_amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + BasketFactory::INIT_SPACE,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Account<'info, BasketFactory>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(decimals: u8)]
pub struct CreateBasket<'info> {
    #[account(
        init, 
        payer = payer,
        space = 8 + Basket::MAX_SIZE
    )]
    pub basket: Account<'info, Basket>,

    #[account(mut)]
    pub payer: Signer<'info>,
    
    // Create new mint account
    #[account(
        init,
        payer = payer,
        mint::decimals = decimals,
        mint::authority = payer.key(),
    )]
    pub mint_account: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintBasketTokens<'info> {
    #[account(mut)]
    pub basket: Account<'info, Basket>,
    #[account(mut)]
    pub basket_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_basket_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub basket_usdc_vault: Account<'info, TokenAccount>,
    /// CHECK: This is a PDA that will be used to transfer USDC from the vault to the user
    #[account(
        mut,
        seeds = [b"basket_authority"], 
        bump
    )]
    pub basket_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemBasketTokens<'info> {
    #[account(mut)]
    pub basket: Account<'info, Basket>,
    #[account(mut)]
    pub basket_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_basket_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub basket_usdc_vault: Account<'info, TokenAccount>,
    /// CHECK: This is a PDA that will be used to transfer USDC from the vault to the user
    #[account(
        mut, 
        seeds = [b"basket_authority"], 
        bump
    )]
    pub basket_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    #[account(mut)]
    pub basket: Account<'info, Basket>,
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct BasketFactory {
    pub authority: Pubkey,
    pub total_baskets: u64,
    pub bump: u8,
}

impl BasketFactory {
    pub const INIT_SPACE: usize = 32 // authority
        + 8 // total_baskets
        + 1; // bump
}

#[account]
#[derive(InitSpace)]
pub struct Basket {
    pub payer: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(32)]
    pub symbol: String,
    #[max_len(256)]
    pub description: String,
    pub tokens: [Pubkey; 10], // Fixed array instead of Vec
    pub weights: [u8; 10],    // Fixed array instead of Vec
    pub token_count: u8,      // Track actual number of tokens used
    pub total_weight: u64,
    pub fee_bps: u16, // fee in basis points (1% = 100 bps)
}

impl Basket {
    pub const MAX_SIZE: usize = 32 // payer
        + 4 + 64 // name (max 64 chars)
        + 4 + 256 // description (max 256 chars)
        + (32 * 10) // tokens (fixed array of 10)
        + 10 // weights (fixed array of 10)
        + 1 // token_count
        + 8 // total_weight
        + 2; // fee_bps
        
    // Helper method to get active tokens
    pub fn get_active_tokens(&self) -> &[Pubkey] {
        &self.tokens[..self.token_count as usize]
    }
    
    // Helper method to get active weights
    pub fn get_active_weights(&self) -> &[u8] {
        &self.weights[..self.token_count as usize]
    }
}

#[error_code]
pub enum BasketError {
    #[msg("Invalid input data")]
    InvalidInput,
    #[msg("Weights must sum to 100")]
    InvalidWeights,
    #[msg("Insufficient USDC balance")]
    InsufficientUsdc,
    #[msg("Math underflow or overflow")]
    MathError,
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Too many tokens (max 10)")]
    TooManyTokens,
}