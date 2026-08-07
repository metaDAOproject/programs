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
        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

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

        // Kind gates, checked at launch rather than create so that pre-created
        // drafts can't bypass them
        let params = self.proposal.action.params();

        if params.requires_team_sponsorship {
            require!(
                self.proposal.is_team_sponsored,
                FutarchyError::ProposalNotTeamSponsored
            );
        }

        // A market that doesn't outlive its start delay reaches its nominal end
        // with an empty aggregator, and `MarketsTooYoung` blocks finalize.
        // Strict, because finalize needs the last update past that boundary.
        require_gt!(
            self.proposal.duration_in_seconds,
            params.twap_start_delay_seconds,
            FutarchyError::ProposalDurationTooShort
        );

        let last_failed_at = match self.proposal.action {
            ProposalAction::HostileTakeover { .. } => Some(self.dao.last_failed_takeover_at),
            ProposalAction::HostileLiquidate { .. } => Some(self.dao.last_failed_liquidation_at),
            _ => None,
        };
        if let Some(last_failed_at) = last_failed_at {
            require_gte!(
                Clock::get()?.unix_timestamp,
                last_failed_at + params.cooldown_seconds as i64,
                FutarchyError::HostileCooldownActive
            );
        }

        // Can only launch a proposal if the underlying squads proposal is active
        // This prevents a situation where we enter futarchy with an invalid squads proposal state, thus bricking it.
        require!(
            matches!(
                self.squads_proposal.status,
                squads_multisig_program::ProposalStatus::Active { .. }
            ),
            FutarchyError::InvalidSquadsProposalStatus
        );

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

        // Per-kind, not per-DAO: `dao.twap_start_delay_seconds` is vestigial.
        let twap_start_delay_seconds = proposal.action.params().twap_start_delay_seconds;

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
                    twap_start_delay_seconds,
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
                    twap_start_delay_seconds,
                ),
            },
        };

        // Update proposal state to Pending and set timestamp enqueued
        proposal.state = ProposalState::Pending;
        proposal.timestamp_enqueued = clock.unix_timestamp;

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
