use damm_v2_cpi::{constants::seeds::POSITION_NFT_ACCOUNT_PREFIX, program::DammV2Cpi};

use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

pub mod pool_authority {
    use anchor_lang::prelude::declare_id;

    // DAMM V2 Pool Authority
    declare_id!("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
}

#[derive(Accounts)]
#[event_cpi]
pub struct CollectMeteoraDammFees<'info> {
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    pub admin: Signer<'info>,

    // Meteora DAMM - token_a_account
    #[account(mut, token::mint = dao.base_mint, address = meteora_claim_position_fees_accounts.token_a_account.key())]
    pub base_token_account: Account<'info, TokenAccount>,

    // Meteora DAMM - token_b_account
    #[account(mut, token::mint = dao.quote_mint, address = meteora_claim_position_fees_accounts.token_b_account.key())]
    pub quote_token_account: Account<'info, TokenAccount>,

    /// CHECK: checked by autocrat program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_vault_transaction:
        Account<'info, squads_multisig_program::VaultTransaction>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_proposal: Account<'info, squads_multisig_program::Proposal>,

    pub meteora_claim_position_fees_accounts: MeteoraClaimPositionFeesAccounts<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

#[derive(Accounts)]
pub struct MeteoraClaimPositionFeesAccounts<'info> {
    pub damm_v2_program: Program<'info, DammV2Cpi>,

    /// CHECK: checked by damm v2 program
    #[account(address = pool_authority::ID)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub pool: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// The user token a account (base token)
    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_a_account: UncheckedAccount<'info>,

    /// The user token b account (quote token)
    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_b_account: UncheckedAccount<'info>,

    /// The vault token account for input token (base token)
    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// The vault token account for output token (quote token)
    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// The mint of token a (base mint)
    /// CHECK: Checked from dao struct
    pub token_a_mint: UncheckedAccount<'info>,

    /// The mint of token b (quote mint)
    /// CHECK: Checked from dao struct
    pub token_b_mint: UncheckedAccount<'info>,

    /// The token account for nft (derived from base token mint)
    /// CHECK: CPI
    #[account(mut, seeds = [POSITION_NFT_ACCOUNT_PREFIX.as_ref(), position_nft_mint.key().as_ref()], bump, seeds::program = damm_v2_program)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// owner of position - DAO's squads multisig
    pub owner: Signer<'info>,

    /// Token a program
    /// CHECK: CPI
    pub token_a_program: UncheckedAccount<'info>,

    /// Token b program
    /// CHECK: CPI
    pub token_b_program: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [b"position_nft_mint", token_a_mint.key().as_ref()], bump)]
    pub position_nft_mint: UncheckedAccount<'info>,
}

impl CollectMeteoraDammFees<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // TODO - Add the actual instruction to claim fees here.
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts
                .meteora_claim_position_fees_accounts
                .token_a_vault
                .key(),
            &ctx.accounts
                .meteora_claim_position_fees_accounts
                .token_a_account
                .key(),
            100,
        );

        let transaction_message = anchor_lang::solana_program::message::Message::new(
            &[ix],
            Some(&ctx.accounts.admin.key()),
        );

        squads_multisig_program::cpi::vault_transaction_create(
            CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionCreate {
                    creator: ctx.accounts.dao.to_account_info(), // DAO should be the creator?
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    rent_payer: ctx.accounts.admin.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    transaction: ctx
                        .accounts
                        .squads_multisig_vault_transaction
                        .to_account_info(),
                },
            ),
            squads_multisig_program::VaultTransactionCreateArgs {
                ephemeral_signers: 0,
                vault_index: 0,
                transaction_message: transaction_message.serialize(),
                memo: None,
            },
        )?;

        // Reload the squads multisig account to get the latest transaction index
        ctx.accounts.squads_multisig.reload()?;
        let transaction_index = ctx.accounts.squads_multisig.transaction_index;

        squads_multisig_program::cpi::proposal_create(
            CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalCreate {
                    // DAO is the config authority - maybe this needs to be the permissionless account instead?
                    creator: ctx.accounts.dao.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    rent_payer: ctx.accounts.admin.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                },
            ),
            squads_multisig_program::ProposalCreateArgs {
                transaction_index,
                draft: false,
            },
        )?;

        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    member: ctx.accounts.dao.to_account_info(), // DAO is the config authority
                },
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        squads_multisig_program::cpi::vault_transaction_execute(CpiContext::new(
            ctx.accounts.squads_program.to_account_info(),
            squads_multisig_program::cpi::accounts::VaultTransactionExecute {
                transaction: ctx
                    .accounts
                    .squads_multisig_vault_transaction
                    .to_account_info(),
                proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                multisig: ctx.accounts.squads_multisig.to_account_info(),
                member: ctx.accounts.dao.to_account_info(), // DAO is the config authority
            },
        ))?;

        Ok(())
    }
}
