// errors.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Invalid mint account - does not match basket config")]
    InvalidMint,
    #[msg("Invalid token account - mint does not match basket")]
    InvalidTokenAccount,
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    #[msg("Token and weight length mismatch")]
    TokenWeightMismatch,
    #[msg("Too many tokens in basket")]
    TooManyTokens,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Weights must sum to exactly 10000")]
    WeightsSumError,
    #[msg("Mismatched arrays")]
    MismatchedArrays,
}