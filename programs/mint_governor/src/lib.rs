//! Mint Governor
//!
//! This program manages minting authority for SPL tokens, allowing an admin
//! to delegate minting rights to multiple authorized minters with optional limits.

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "mint_governor",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.7.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH");

#[program]
pub mod mint_governor {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_mint_governor(ctx: Context<InitializeMintGovernor>) -> Result<()> {
        InitializeMintGovernor::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn transfer_authority_to_governor(ctx: Context<TransferAuthorityToGovernor>) -> Result<()> {
        TransferAuthorityToGovernor::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn add_mint_authority(
        ctx: Context<AddMintAuthority>,
        args: AddMintAuthorityArgs,
    ) -> Result<()> {
        AddMintAuthority::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn mint_tokens(ctx: Context<MintTokens>, args: MintTokensArgs) -> Result<()> {
        MintTokens::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn update_mint_authority(
        ctx: Context<UpdateMintAuthority>,
        args: UpdateMintAuthorityArgs,
    ) -> Result<()> {
        UpdateMintAuthority::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn remove_mint_authority(ctx: Context<RemoveMintAuthority>) -> Result<()> {
        RemoveMintAuthority::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn update_mint_governor_admin(ctx: Context<UpdateMintGovernorAdmin>) -> Result<()> {
        UpdateMintGovernorAdmin::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn reclaim_authority(ctx: Context<ReclaimAuthority>) -> Result<()> {
        ReclaimAuthority::handle(ctx)
    }
}
