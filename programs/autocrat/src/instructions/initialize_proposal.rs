use super::*;

use amm::program::Amm as AmmProgram;
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use amm::state::ONE_MINUTE_IN_SLOTS;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::{self, AssociatedToken};
// use amm::cpi::accounts::AddOrRemoveLiquidity;
use amm::instructions::{AddLiquidityArgs, CreateAmmArgs};

// use amm::AddLiquidityArgs;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
    pub description_url: String,
    pub instruction: ProposalInstruction,
    pub pass_lp_tokens_to_lock: u64,
    pub fail_lp_tokens_to_lock: u64,
    pub nonce: u64,
    pub base_tokens_to_lp: u64,
    pub quote_tokens_to_lp: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeProposalParams)]
#[event_cpi]
pub struct InitializeProposal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(
        init,
        payer = proposer,
        space = 500,
        seeds = [b"proposal", proposer.key().as_ref(), &args.nonce.to_le_bytes()],
        bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    /// CHECK: checked by vault program
    pub question: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub quote_vault: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub base_vault: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_amm: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_lp_mint: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_lp_mint: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_amm: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub pass_base_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub pass_quote_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub base_vault_underlying_token_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub quote_vault_underlying_token_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub user_base_token_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub user_quote_token_account: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub pass_base_mint: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub pass_quote_mint: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub fail_base_mint: UncheckedAccount<'info>,
    /// CHECK: checked by vault program
    #[account(mut)]
    pub fail_quote_mint: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_base_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_quote_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_amm_base_vault: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_amm_quote_vault: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_amm_base_vault: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_amm_quote_vault: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_lp_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_lp_user_account: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub pass_lp_vault_account: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    #[account(mut)]
    pub fail_lp_vault_account: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub amm_program: Program<'info, AmmProgram>,
    pub conditional_vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: checked by vault program
    pub vault_event_authority: UncheckedAccount<'info>,
    /// CHECK: checked by AMM program
    pub amm_event_authority: UncheckedAccount<'info>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        // for amm in [&self.pass_amm, &self.fail_amm] {
        //     // an attacker is able to crank 5 observations before a proposal starts
        //     require!(
        //         clock.slot < amm.created_at_slot + (5 * ONE_MINUTE_IN_SLOTS),
        //         AutocratError::AmmTooOld
            // );

            // require_eq!(
            //     amm.oracle.initial_observation,
            //     self.dao.twap_initial_observation,
            //     AutocratError::InvalidInitialObservation
            // );

            // require_eq!(
            //     amm.oracle.max_observation_change_per_update,
            //     self.dao.twap_max_observation_change_per_update,
            //     AutocratError::InvalidMaxObservationChange
            // );
        // }

        // Should never be the case because the oracle is the proposal account, and you can't re-initialize a proposal
        // assert!(!self.question.is_resolved());

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalParams) -> Result<()> {
        let Self {
            proposer,
            proposal,
            dao,
            base_vault,
            quote_vault,
            question,
            pass_amm,
            fail_amm,
            pass_lp_mint,
            fail_lp_mint,
            pass_base_user_account,
            pass_quote_user_account,
            fail_base_user_account,
            fail_quote_user_account,
            pass_amm_base_vault,
            pass_amm_quote_vault,
            // pass_base_mint,
            // pass_quote_mint,
            fail_amm_base_vault,
            fail_amm_quote_vault,
            pass_lp_user_account,
            pass_lp_vault_account,
            fail_lp_vault_account,
            token_program,
            system_program,
            event_authority: _,
            program: _,
            // proposer,
            // proposal,
            amm_program,
            associated_token_program,
            amm_event_authority,
            vault_event_authority,
            conditional_vault_program,
            base_vault_underlying_token_account,
            quote_vault_underlying_token_account,
            user_base_token_account,
            user_quote_token_account,
            pass_base_mint,
            pass_quote_mint,
            fail_base_mint,
            fail_quote_mint,
            fail_lp_user_account,
        } = ctx.accounts;

        let InitializeProposalParams {
            description_url,
            instruction,
            pass_lp_tokens_to_lock,
            fail_lp_tokens_to_lock,
            nonce,
            base_tokens_to_lp,
            quote_tokens_to_lp,
        } = params;

        {
        conditional_vault::cpi::split_tokens(
            CpiContext::new(
                conditional_vault_program.to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: question.to_account_info(),
                    vault: base_vault.to_account_info(),
                    vault_underlying_token_account: base_vault_underlying_token_account.to_account_info(),
                    authority: proposer.to_account_info(),
                    user_underlying_token_account: user_base_token_account.to_account_info(),
                    event_authority: vault_event_authority.to_account_info(),
                    program: conditional_vault_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                },
            // ),
            ).with_remaining_accounts(vec![
                fail_base_mint.to_account_info(),
                pass_base_mint.to_account_info(),
                fail_base_user_account.to_account_info(),
                pass_base_user_account.to_account_info(),
            ]),
            base_tokens_to_lp,
        )?;

        conditional_vault::cpi::split_tokens(
            CpiContext::new(
                conditional_vault_program.to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: question.to_account_info(),
                    vault: quote_vault.to_account_info(),
                    vault_underlying_token_account: quote_vault_underlying_token_account.to_account_info(),
                    authority: proposer.to_account_info(),
                    user_underlying_token_account: user_quote_token_account.to_account_info(),
                    event_authority: vault_event_authority.to_account_info(),
                    program: conditional_vault_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                },
            // ),
            ).with_remaining_accounts(vec![
                fail_quote_mint.to_account_info(),
                pass_quote_mint.to_account_info(),
                fail_quote_user_account.to_account_info(),
                pass_quote_user_account.to_account_info(),
            ]),
            quote_tokens_to_lp,
        )?;
        }

        {
            amm::cpi::create_amm(
                CpiContext::new(
                    amm_program.to_account_info(),
                    amm::cpi::accounts::CreateAmm {
                        user: proposer.to_account_info(),
                        amm: pass_amm.to_account_info(),
                        lp_mint: pass_lp_mint.to_account_info(),
                        base_mint: pass_base_mint.to_account_info(),
                        quote_mint: pass_quote_mint.to_account_info(),
                        vault_ata_base: pass_amm_base_vault.to_account_info(),
                        vault_ata_quote: pass_amm_quote_vault.to_account_info(),
                        program: amm_program.to_account_info(),
                        event_authority: amm_event_authority.to_account_info(),
                        system_program: system_program.to_account_info(),
                        associated_token_program: associated_token_program.to_account_info(),
                        token_program: token_program.to_account_info(),
                    },
                ),
                CreateAmmArgs {
                    twap_initial_observation: dao.twap_initial_observation,
                    twap_max_observation_change_per_update: dao.twap_max_observation_change_per_update,
                }
            )?;

            amm::cpi::create_amm(
                CpiContext::new(
                    amm_program.to_account_info(),
                    amm::cpi::accounts::CreateAmm {
                        user: proposer.to_account_info(),
                        amm: fail_amm.to_account_info(),
                        lp_mint: fail_lp_mint.to_account_info(),
                        base_mint: fail_base_mint.to_account_info(),
                        quote_mint: fail_quote_mint.to_account_info(),
                        vault_ata_base: fail_amm_base_vault.to_account_info(),
                        vault_ata_quote: fail_amm_quote_vault.to_account_info(),
                        program: amm_program.to_account_info(),
                        event_authority: amm_event_authority.to_account_info(),
                        system_program: system_program.to_account_info(),
                        associated_token_program: associated_token_program.to_account_info(),
                        token_program: token_program.to_account_info(),
                    },
                ),
                CreateAmmArgs {
                    twap_initial_observation: dao.twap_initial_observation,
                    twap_max_observation_change_per_update: dao.twap_max_observation_change_per_update,
                }
            )?;
        }

        associated_token::create(
            CpiContext::new(
                associated_token_program.to_account_info(),
                associated_token::Create {
                    payer: proposer.to_account_info(),
                    mint: fail_lp_mint.to_account_info(),
                    associated_token: fail_lp_user_account.to_account_info(),
                    authority: proposer.to_account_info(),
                    system_program: system_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                },
            ),
        )?;

        amm::cpi::add_liquidity(
            CpiContext::new(
                amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    user: proposer.to_account_info(),
                    amm: fail_amm.to_account_info(),
                    lp_mint: fail_lp_mint.to_account_info(),
                    user_lp_account: fail_lp_user_account.to_account_info(),
                    user_base_account: fail_base_user_account.to_account_info(),
                    user_quote_account: fail_quote_user_account.to_account_info(),
                    vault_ata_base: fail_amm_base_vault.to_account_info(),
                    vault_ata_quote: fail_amm_quote_vault.to_account_info(),
                    event_authority: amm_event_authority.to_account_info(),
                    program: amm_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                    system_program: system_program.to_account_info(),
                    associated_token_program: associated_token_program.to_account_info(),
                },
            ),
            AddLiquidityArgs {
                quote_amount: quote_tokens_to_lp,
                max_base_amount: base_tokens_to_lp,
                min_lp_tokens: 0,
            },
        )?;

        associated_token::create(
            CpiContext::new(
                associated_token_program.to_account_info(),
                associated_token::Create {
                    payer: proposer.to_account_info(),
                    mint: pass_lp_mint.to_account_info(),
                    associated_token: pass_lp_user_account.to_account_info(),
                    authority: proposer.to_account_info(),
                    system_program: system_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                },
            ),
        )?;

        amm::cpi::add_liquidity(
            CpiContext::new(
                amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    user: proposer.to_account_info(),
                    amm: pass_amm.to_account_info(),
                    lp_mint: pass_lp_mint.to_account_info(),
                    user_lp_account: pass_lp_user_account.to_account_info(),
                    user_base_account: pass_base_user_account.to_account_info(),
                    user_quote_account: pass_quote_user_account.to_account_info(),
                    vault_ata_base: pass_amm_base_vault.to_account_info(),
                    vault_ata_quote: pass_amm_quote_vault.to_account_info(),
                    event_authority: amm_event_authority.to_account_info(),
                    program: amm_program.to_account_info(),
                    token_program: token_program.to_account_info(),
                    system_program: system_program.to_account_info(),
                    associated_token_program: associated_token_program.to_account_info(),
                },
            ),
            AddLiquidityArgs {
                quote_amount: quote_tokens_to_lp,
                max_base_amount: base_tokens_to_lp,
                min_lp_tokens: 0,
            },
        )?;



        return Ok(());

        // pass_lp_user_account.reload()?;
        // fail_lp_user_account.reload()?;
        // pass_lp_mint.reload()?;
        // pass_amm.reload()?;

        // require_gte!(
        //     pass_lp_user_account.amount,
        //     pass_lp_tokens_to_lock,
        //     AutocratError::InsufficientLpTokenBalance
        // );
        // require_gte!(
        //     fail_lp_user_account.amount,
        //     fail_lp_tokens_to_lock,
        //     AutocratError::InsufficientLpTokenBalance
        // );

        // let (pass_base_liquidity, pass_quote_liquidity) =
        //     pass_amm.get_base_and_quote_withdrawable(pass_lp_tokens_to_lock, pass_lp_mint.supply);
        // let (fail_base_liquidity, fail_quote_liquidity) =
        //     fail_amm.get_base_and_quote_withdrawable(fail_lp_tokens_to_lock, fail_lp_mint.supply);

        // for base_liquidity in [pass_base_liquidity, fail_base_liquidity] {
        //     require_gte!(
        //         base_liquidity,
        //         dao.min_base_futarchic_liquidity,
        //         AutocratError::InsufficientLpTokenLock
        //     );
        // }

        // for quote_liquidity in [pass_quote_liquidity, fail_quote_liquidity] {
        //     require_gte!(
        //         quote_liquidity,
        //         dao.min_quote_futarchic_liquidity,
        //         AutocratError::InsufficientLpTokenLock
        //     );
        // }

        // for (amount, from, to) in [
        //     (
        //         pass_lp_tokens_to_lock,
        //         &pass_lp_user_account,
        //         &pass_lp_vault_account,
        //     ),
        //     (
        //         fail_lp_tokens_to_lock,
        //         &fail_lp_user_account,
        //         &fail_lp_vault_account,
        //     ),
        // ] {
        //     token::transfer(
        //         CpiContext::new(
        //             token_program.to_account_info(),
        //             Transfer {
        //                 from: from.to_account_info(),
        //                 to: to.to_account_info(),
        //                 authority: proposer.to_account_info(),
        //             },
        //         ),
        //         amount,
        //     )?;
        // }

        // let clock = Clock::get()?;

        // dao.proposal_count += 1;

        // proposal.set_inner(Proposal {
        //     number: dao.proposal_count,
        //     proposer: proposer.key(),
        //     description_url,
        //     slot_enqueued: clock.slot,
        //     state: ProposalState::Pending,
        //     instruction: instruction.clone(),
        //     pass_amm: pass_amm.key(),
        //     fail_amm: fail_amm.key(),
        //     base_vault: base_vault.key(),
        //     quote_vault: quote_vault.key(),
        //     dao: dao.key(),
        //     pass_lp_tokens_locked: pass_lp_tokens_to_lock,
        //     fail_lp_tokens_locked: fail_lp_tokens_to_lock,
        //     nonce,
        //     pda_bump: ctx.bumps.proposal,
        //     question: question.key(),
        // });

        // emit_cpi!(InitializeProposalEvent {
        //     common: CommonFields::new(&clock),
        //     proposal: proposal.key(),
        //     dao: dao.key(),
        //     question: question.key(),
        //     pass_amm: pass_amm.key(),
        //     fail_amm: fail_amm.key(),
        //     base_vault: base_vault.key(),
        //     quote_vault: quote_vault.key(),
        //     pass_lp_mint: pass_lp_mint.key(),
        //     fail_lp_mint: fail_lp_mint.key(),
        //     proposer: proposer.key(),
        //     nonce,
        //     number: dao.proposal_count,
        //     pass_lp_tokens_locked: pass_lp_tokens_to_lock,
        //     fail_lp_tokens_locked: fail_lp_tokens_to_lock,
        //     pda_bump: ctx.bumps.proposal,
        //     instruction,
        // });

        Ok(())
    }
}
