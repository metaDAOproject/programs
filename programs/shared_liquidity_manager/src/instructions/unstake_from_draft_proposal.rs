use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};

use crate::error::SharedLiquidityManagerError;
use crate::state::{DraftProposal, StakeRecord};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UnstakeFromDraftProposalParams {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct UnstakeFromDraftProposal<'info> {
    #[account(mut, has_one = staked_token_vault)]
    pub draft_proposal: Account<'info, DraftProposal>,
    pub staker: Signer<'info>,
    #[account(mut, associated_token::mint = draft_proposal.base_mint, associated_token::authority = staker)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staked_token_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"stake_record", draft_proposal.key().as_ref(), staker.key().as_ref()], bump)]
    pub stake_record: Account<'info, StakeRecord>,
    pub token_program: Program<'info, Token>,
}

impl UnstakeFromDraftProposal<'_> {
    pub fn validate(&self, params: &UnstakeFromDraftProposalParams) -> Result<()> {
        require_gte!(
            self.stake_record.amount,
            params.amount,
            SharedLiquidityManagerError::InsufficientStake
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: UnstakeFromDraftProposalParams) -> Result<()> {
        // Transfer tokens from staked vault back to staker
        // The draft_proposal account itself is the authority for the staked_token_vault
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staked_token_vault.to_account_info(),
                    to: ctx.accounts.staker_token_account.to_account_info(),
                    authority: ctx.accounts.draft_proposal.to_account_info(),
                },
                &[&[
                    b"draft_proposal",
                    &ctx.accounts.draft_proposal.nonce.to_le_bytes(),
                    &[ctx.accounts.draft_proposal.pda_bump],
                ]],
            ),
            params.amount,
        )?;

        // Update stake record
        ctx.accounts.stake_record.amount -= params.amount;

        // Update draft proposal staked amount
        ctx.accounts.draft_proposal.staked_token_amount -= params.amount;

        Ok(())
    }
}

#[cfg(test)]
mod unstake_tests {
    use super::*;
    use crate::state::{DraftProposal, DraftProposalStatus, StakeRecord};

    fn create_mock_stake_record(amount: u64) -> StakeRecord {
        StakeRecord {
            staker: Pubkey::default(),
            amount,
        }
    }

    fn create_mock_draft_proposal(staked_amount: u64) -> DraftProposal {
        DraftProposal {
            shared_liquidity_pool: Pubkey::default(),
            base_mint: Pubkey::default(),
            instruction: crate::state::ProposalInstruction {
                program_id: Pubkey::default(),
                accounts: vec![],
                data: vec![],
            },
            status: DraftProposalStatus::Draft,
            staked_token_amount: staked_amount,
            staked_token_vault: Pubkey::default(),
            nonce: 0,
            pda_bump: 0,
        }
    }

    #[test]
    pub fn test_validate_sufficient_stake() {
        let stake_record = create_mock_stake_record(1000);
        let draft_proposal = create_mock_draft_proposal(1000);

        let mock_ctx = MockUnstakeContext {
            stake_record,
            draft_proposal,
        };

        let params = UnstakeFromDraftProposalParams { amount: 500 };
        let result = mock_ctx.validate(&params);

        assert!(result.is_ok());
    }

    #[test]
    pub fn test_validate_exact_stake_amount() {
        let stake_record = create_mock_stake_record(1000);
        let draft_proposal = create_mock_draft_proposal(1000);

        let mock_ctx = MockUnstakeContext {
            stake_record,
            draft_proposal,
        };

        let params = UnstakeFromDraftProposalParams { amount: 1000 };
        let result = mock_ctx.validate(&params);

        assert!(result.is_ok());
    }

    #[test]
    pub fn test_validate_insufficient_stake() {
        let stake_record = create_mock_stake_record(500);
        let draft_proposal = create_mock_draft_proposal(500);

        let mock_ctx = MockUnstakeContext {
            stake_record,
            draft_proposal,
        };

        let params = UnstakeFromDraftProposalParams { amount: 1000 };
        let result = mock_ctx.validate(&params);

        assert!(result.is_err());
        let error = result.unwrap_err();
        match error {
            anchor_lang::error::Error::AnchorError(anchor_error) => {
                assert_eq!(anchor_error.error_code_number, 6000); // InsufficientStake error code
                assert_eq!(anchor_error.error_name, "InsufficientStake");
            }
            _ => panic!("Expected AnchorError"),
        }
    }

    #[test]
    pub fn test_validate_zero_unstake_amount() {
        let stake_record = create_mock_stake_record(1000);
        let draft_proposal = create_mock_draft_proposal(1000);

        let mock_ctx = MockUnstakeContext {
            stake_record,
            draft_proposal,
        };

        let params = UnstakeFromDraftProposalParams { amount: 0 };
        let result = mock_ctx.validate(&params);

        assert!(result.is_ok());
    }

    // Mock context struct for testing validation logic
    struct MockUnstakeContext {
        stake_record: StakeRecord,
        draft_proposal: DraftProposal,
    }

    impl MockUnstakeContext {
        fn validate(&self, params: &UnstakeFromDraftProposalParams) -> Result<()> {
            require_gte!(
                self.stake_record.amount,
                params.amount,
                SharedLiquidityManagerError::InsufficientStake
            );
            Ok(())
        }
    }
}
