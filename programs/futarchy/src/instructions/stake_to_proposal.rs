use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct StakeToProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: StakeToProposalParams)]
#[event_cpi]
pub struct StakeToProposal<'info> {
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
        init_if_needed,
        payer = payer,
        seeds = [SEED_STAKE, proposal.key().as_ref(), staker.key().as_ref()],
        bump,
        space = 8 + StakeAccount::INIT_SPACE,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,
    pub staker: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl StakeToProposal<'_> {
    pub fn validate(&self, params: &StakeToProposalParams) -> Result<()> {
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        require_keys_eq!(self.proposal.dao, self.dao.key());

        require_gte!(
            self.staker_base_account.amount,
            params.amount,
            FutarchyError::InsufficientTokenBalance
        );

        require_gt!(params.amount, 0, FutarchyError::InvalidAmount);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: StakeToProposalParams) -> Result<()> {
        let Self {
            proposal,
            dao,
            staker_base_account,
            proposal_base_account,
            stake_account,
            staker,
            payer: _,
            token_program,
            system_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let StakeToProposalParams { amount } = params;

        // Transfer tokens from staker to proposal
        let transfer_ctx = CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: staker_base_account.to_account_info(),
                to: proposal_base_account.to_account_info(),
                authority: staker.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Update proposal state
        if let ProposalState::Draft { mut amount_staked } = proposal.state {
            amount_staked += amount;
            proposal.state = ProposalState::Draft { amount_staked };
        }

        // Update stake account
        if stake_account.proposal == Pubkey::default() {
            // Initialize the stake account
            stake_account.proposal = proposal.key();
            stake_account.staker = staker.key();
            stake_account.amount = amount;
            stake_account.bump = ctx.bumps.stake_account;
        } else {
            // Add to existing stake
            stake_account.amount += amount;
        }

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(StakeToProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            staker: staker.key(),
            amount,
            total_staked: match proposal.state {
                ProposalState::Draft { amount_staked } => amount_staked,
                _ => unreachable!(),
            },
        });

        Ok(())
    }
}
