use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UnstakeFromProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: UnstakeFromProposalParams)]
#[event_cpi]
pub struct UnstakeFromProposal<'info> {
    #[account(mut)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = staker,
    )]
    pub staker_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = proposal,
    )]
    pub proposal_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"stake", proposal.key().as_ref(), staker.key().as_ref()],
        bump = stake_account.bump,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,
    pub staker: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl UnstakeFromProposal<'_> {
    pub fn validate(&self, params: &UnstakeFromProposalParams) -> Result<()> {
        require_keys_eq!(self.proposal.dao, self.dao.key());

        require_gt!(params.amount, 0, FutarchyError::InvalidAmount);

        // Check if staker has enough staked
        require_gte!(
            self.stake_account.amount,
            params.amount,
            FutarchyError::InsufficientTokenBalance
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: UnstakeFromProposalParams) -> Result<()> {
        let Self {
            proposal,
            dao,
            staker_base_account,
            proposal_base_account,
            stake_account,
            staker,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let UnstakeFromProposalParams { amount } = params;

        // Transfer tokens from proposal back to staker
        let seeds = &[
            b"proposal",
            proposal.squads_proposal.as_ref(),
            &[proposal.pda_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: proposal_base_account.to_account_info(),
                to: staker_base_account.to_account_info(),
                authority: proposal.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update proposal state if in draft
        if let ProposalState::Draft { mut amount_staked } = proposal.state {
            amount_staked = amount_staked.saturating_sub(amount);
            proposal.state = ProposalState::Draft { amount_staked };
        }

        // Update stake account
        stake_account.amount = stake_account.amount.saturating_sub(amount);

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(UnstakeFromProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            staker: staker.key(),
            amount,
            total_staked: match proposal.state {
                ProposalState::Draft { amount_staked } => amount_staked,
                _ => 0, // Not in draft state, so no stake
            },
        });

        Ok(())
    }
}
