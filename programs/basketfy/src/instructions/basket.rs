// src/instructions/basket.rs
use {
    anchor_lang::prelude::*,
    crate::state::*,
    crate::events::*,
    crate::errors::CustomError,
    anchor_spl::{
      
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
            CreateMetadataAccountsV3, Metadata,
        },
        token::{ Mint,Token},
    },
};

#[derive(Accounts)]
#[instruction(token_name: String, token_symbol: String, token_uri: String, token_decimals: u8, token_mints: Vec<Pubkey>, weights: Vec<u64>)]
pub struct CreateBTokenMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
    )]
    pub factory: Account<'info, FactoryState>,

    #[account(
        init,
        payer = payer,
        seeds = [b"config", factory.key().as_ref(), &factory.basket_count.to_le_bytes()],
        bump,
        space = 8 + BasketConfig::LEN,
    )]
    pub config: Account<'info, BasketConfig>,

    /// CHECK: This is a PDA used as mint authority, derived and validated through seeds
    #[account(
        seeds = [b"mint-authority", config.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata PDA
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = token_decimals,
        mint::authority = mint_authority.key(),
        mint::freeze_authority = mint_authority.key(),
    )]
    pub mint_account: Account<'info, Mint>,

    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateBTokenMint>,
    token_name: String,
    token_symbol: String,
    token_uri: String,
    token_decimals: u8,
    token_mints: Vec<Pubkey>,
    weights: Vec<u64>,
) -> Result<()> {
    require!(
        token_mints.len() == weights.len(),
        CustomError::TokenWeightMismatch
    );
     require!(token_mints.len() <= MAX_TOKENS, CustomError::TooManyTokens);
    require!(token_name.len() <= MAX_NAME_LENGTH, CustomError::NameTooLong);
    require!(token_symbol.len() <= MAX_SYMBOL_LENGTH, CustomError::SymbolTooLong);
    require!(token_uri.len() <= MAX_URI_LENGTH, CustomError::UriTooLong);
    

     // Check weights sum to 10000 (100%)
    let total_weight: u64 = weights.iter().sum();
    require!(total_weight == 10000, CustomError::WeightsSumError);


    let factory = &mut ctx.accounts.factory;
    let config = &mut ctx.accounts.config;

    // Record basket config
    config.mint = ctx.accounts.mint_account.key();
    config.creator = ctx.accounts.payer.key();
    config.name = token_name.clone();
    config.symbol = token_symbol.clone();
    config.uri = token_uri.clone();

    config.decimals = token_decimals.clone();
    config.token_mints = token_mints;
    config.weights = weights;
    config.created_at = Clock::get()?.unix_timestamp;


        // Get the mint authority bump for signing
    let config_key = config.key();
    let mint_authority_bump = ctx.bumps.mint_authority;
    let mint_authority_seeds = &[
        b"mint-authority",
        config_key.as_ref(),
        &[mint_authority_bump],
    ];
    let signer_seeds = &[&mint_authority_seeds[..]];

    // CPI to Metaplex to create metadata
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(),
                mint_authority: ctx.accounts.mint_authority.to_account_info(),
                update_authority: ctx.accounts.mint_authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
             signer_seeds,
        ),
        DataV2 {
            name: token_name,
            symbol: token_symbol,
            uri: token_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false,
        true,
        None,
    )?;

    // Increment basket count
    factory.basket_count += 1;

    emit!(BasketCreated {
        mint: config.mint,
        creator: config.creator,
        name: config.name.clone(),
        symbol: config.symbol.clone(),
        uri: config.uri.clone(),
        created_at: config.created_at,
        token_mints: config.token_mints.clone(),
        weights: config.weights.clone(),
    });

    Ok(())
}
