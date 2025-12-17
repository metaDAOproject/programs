use anchor_lang::InstructionData;
use damm_v2_cpi::program::DammV2Cpi;

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
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: checked by autocrat program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_vault_transaction: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_proposal: UncheckedAccount<'info>,

    #[account(address = permissionless_account::id())]
    pub squads_multisig_permissionless_account: Signer<'info>,

    pub meteora_claim_position_fees_accounts: MeteoraClaimPositionFeesAccounts<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

#[derive(Accounts)]
pub struct MeteoraClaimPositionFeesAccounts<'info> {
    pub damm_v2_program: Program<'info, DammV2Cpi>,

    /// CHECK: checked by damm v2 program
    pub damm_v2_event_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(address = pool_authority::ID)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub pool: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_a_account: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_b_account: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// CHECK: Checked from dao struct
    pub token_a_mint: UncheckedAccount<'info>,

    /// CHECK: Checked from dao struct
    pub token_b_mint: UncheckedAccount<'info>,

    /// CHECK: CPI
    pub position_nft_account: UncheckedAccount<'info>,

    /// owner of position - DAO's squads multisig
    /// CHECK: checked by damm v2 program
    pub owner: UncheckedAccount<'info>,

    /// Token a program
    /// CHECK: CPI
    pub token_a_program: UncheckedAccount<'info>,

    /// Token b program
    /// CHECK: CPI
    pub token_b_program: UncheckedAccount<'info>,
}

impl CollectMeteoraDammFees<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let ix_data = damm_v2_cpi::instruction::ClaimPositionFee {}.data();

        let account_infos = damm_v2_cpi::cpi::accounts::ClaimPositionFeeCtx {
            pool_authority: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .pool_authority
                .to_account_info(),
            pool: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .pool
                .to_account_info(),
            position: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .position
                .to_account_info(),
            token_a_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_account
                .to_account_info(),
            token_b_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_account
                .to_account_info(),
            token_a_vault: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_vault
                .to_account_info(),
            token_b_vault: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_vault
                .to_account_info(),
            token_a_mint: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_mint
                .to_account_info(),
            token_b_mint: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_mint
                .to_account_info(),
            position_nft_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .position_nft_account
                .to_account_info(),
            owner: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .owner
                .to_account_info(),
            token_a_program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_program
                .to_account_info(),
            token_b_program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_program
                .to_account_info(),
            event_authority: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .damm_v2_event_authority
                .to_account_info(),
            program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .damm_v2_program
                .to_account_info(),
        };

        let accounts = account_infos.to_account_metas(None);

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: damm_v2_cpi::ID,
            accounts,
            data: ix_data,
        };

        let transaction_message = anchor_lang::solana_program::message::Message::new(
            &[ix],
            Some(&ctx.accounts.admin.key()),
        );

        let dao_nonce = &ctx.accounts.dao.nonce.to_le_bytes();
        let dao_creator_key = ctx.accounts.dao.dao_creator.as_ref();
        let dao_seeds = &[
            b"dao".as_ref(),
            dao_creator_key,
            dao_nonce,
            &[ctx.accounts.dao.pda_bump],
        ];

        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::vault_transaction_create(
            CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionCreate {
                    creator: ctx
                        .accounts
                        .squads_multisig_permissionless_account
                        .to_account_info(),
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
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalCreate {
                    // DAO is the config authority - maybe this needs to be the permissionless account instead?
                    creator: ctx.accounts.dao.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    rent_payer: ctx.accounts.admin.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalCreateArgs {
                transaction_index,
                draft: false,
            },
        )?;

        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    member: ctx.accounts.dao.to_account_info(), // DAO is the config authority
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        Ok(())
    }
}
