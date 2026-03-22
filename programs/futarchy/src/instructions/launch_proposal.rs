use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct LaunchProposal<'info> {
    #[account(mut, has_one = dao, has_one = quote_vault, has_one = base_vault, has_one = squads_proposal)]
    pub proposal: Box<Account<'info, Proposal>>,
    pub base_vault: Box<Account<'info, ConditionalVault>>,
    pub quote_vault: Box<Account<'info, ConditionalVault>>,
    #[account(address = base_vault.conditional_token_mints[1])]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(address = quote_vault.conditional_token_mints[1])]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(address = base_vault.conditional_token_mints[0])]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(address = quote_vault.conditional_token_mints[0])]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init_if_needed, payer = payer, associated_token::mint = pass_base_mint, associated_token::authority = dao)]
    pub amm_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, payer = payer, associated_token::mint = pass_quote_mint, associated_token::authority = dao)]
    pub amm_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, payer = payer, associated_token::mint = fail_base_mint, associated_token::authority = dao)]
    pub amm_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, payer = payer, associated_token::mint = fail_quote_mint, associated_token::authority = dao)]
    pub amm_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_multisig_program::ID)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    #[account(owner = squads_multisig_program::ID)]
    pub squads_proposal: Account<'info, squads_multisig_program::Proposal>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl LaunchProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        msg!("proposal state: {:?}", self.proposal.state);
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        require_keys_eq!(self.proposal.dao, self.dao.key());

        // If the proposal is not team sponsored, check if sufficient stake has been accumulated
        if !self.proposal.is_team_sponsored {
            if let ProposalState::Draft { amount_staked } = self.proposal.state {
                require_gte!(
                    amount_staked,
                    self.dao.base_to_stake,
                    FutarchyError::InsufficientStakeToLaunch
                );
            }
        }

        // Ensure the squads proposal is not invalidated by a previous config transaction
        require_gt!(
            self.squads_proposal.transaction_index,
            self.squads_multisig.stale_transaction_index
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            proposal,
            dao,
            payer: _,
            event_authority: _,
            program: _,
            // Below accounts are just so we can be sure they're initialized
            base_vault: _,
            quote_vault: _,
            pass_base_mint: _,
            pass_quote_mint: _,
            fail_base_mint: _,
            fail_quote_mint: _,
            amm_pass_base_vault: _,
            amm_pass_quote_vault: _,
            amm_fail_base_vault: _,
            amm_fail_quote_vault: _,
            squads_multisig: _,
            squads_proposal: _,
            system_program: _,
            token_program: _,
            associated_token_program: _,
        } = ctx.accounts;

        // Get the total staked amount
        let total_staked = match proposal.state {
            ProposalState::Draft { amount_staked } => amount_staked,
            _ => unreachable!(),
        };

        // Set up the futarchy AMM by splitting the spot pool reserves
        let PoolState::Spot { mut spot } = dao.amm.state.to_owned() else {
            return Err(FutarchyError::PoolNotInSpotState.into());
        };

        let base_to_lp = spot.base_reserves / 2;
        let quote_to_lp = spot.quote_reserves / 2;

        // Prevent launching proposals with zero reserves, which would permanently
        // freeze the DAO (no swaps possible, finalize_proposal fails, no recovery path)
        require_gt!(base_to_lp, 0, FutarchyError::InsufficientLiquidity);
        require_gt!(quote_to_lp, 0, FutarchyError::InsufficientLiquidity);

        spot.base_reserves -= base_to_lp;
        spot.quote_reserves -= quote_to_lp;

        require_gte!(
            base_to_lp,
            dao.min_base_futarchic_liquidity,
            FutarchyError::InsufficientLiquidity
        );
        require_gte!(
            quote_to_lp,
            dao.min_quote_futarchic_liquidity,
            FutarchyError::InsufficientLiquidity
        );

        let clock = Clock::get()?;

        dao.amm.state = PoolState::Futarchy {
            spot,
            pass: Pool {
                base_reserves: base_to_lp,
                quote_reserves: quote_to_lp,
                quote_protocol_fee_balance: 0,
                base_protocol_fee_balance: 0,
                oracle: TwapOracle::new(
                    clock.unix_timestamp,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_seconds,
                ),
            },
            fail: Pool {
                base_reserves: base_to_lp,
                quote_reserves: quote_to_lp,
                quote_protocol_fee_balance: 0,
                base_protocol_fee_balance: 0,
                oracle: TwapOracle::new(
                    clock.unix_timestamp,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_seconds,
                ),
            },
        };

        // Update proposal state to Pending and set timestamp enqueued
        proposal.state = ProposalState::Pending;
        proposal.timestamp_enqueued = clock.unix_timestamp;
        // Additionally, set the duration once more in case it was updated since the proposal was created
        proposal.duration_in_seconds = dao.seconds_per_proposal;

        dao.seq_num += 1;

        emit_cpi!(LaunchProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            timestamp_enqueued: proposal.timestamp_enqueued,
            total_staked,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
