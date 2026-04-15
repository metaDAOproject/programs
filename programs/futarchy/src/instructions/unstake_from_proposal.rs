use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct UnstakeFromProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: UnstakeFromProposalParams)]
#[event_cpi]
pub struct UnstakeFromProposal<'info> {
    #[account(
        mut,
        has_one = dao,
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(
        mut,
        has_one = base_mint,
    )]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        init_if_needed,
        payer = staker,
        associated_token::mint = base_mint,
        associated_token::authority = staker,
    )]
    pub staker_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = proposal,
    )]
    pub proposal_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [SEED_STAKE, proposal.key().as_ref(), staker.key().as_ref()],
        bump = stake_account.bump,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,
    #[account(address = dao.base_mint)]
    pub base_mint: Account<'info, Mint>,
    #[account(mut)]
    pub staker: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl UnstakeFromProposal<'_> {
    pub fn validate(&self, params: &UnstakeFromProposalParams) -> Result<()> {
        let clock = Clock::get()?;

        // When a proposal is launched, we allow unstaking after a small delay
        // Before it is launched, unstaking can happen normally, as the timestamp_enqueued is 0
        require_gte!(
            clock.unix_timestamp,
            self.proposal.timestamp_enqueued + MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS,
            FutarchyError::ProposalNotReadyToUnstake
        );

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
            event_authority: _,
            program: _,
            system_program: _,
            associated_token_program: _,
            base_mint: _,
        } = ctx.accounts;

        let UnstakeFromProposalParams { amount } = params;

        // Transfer tokens from proposal back to staker
        let seeds = &[
            SEED_PROPOSAL,
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
