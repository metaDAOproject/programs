use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct LaunchProposal<'info> {
    #[account(mut, has_one = dao, has_one = quote_vault, has_one = base_vault)]
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
    #[account(mut)]
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
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl LaunchProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            AutocratError::ProposalNotInDraftState
        );

        require_keys_eq!(self.proposal.dao, self.dao.key());

        // Check if sufficient stake has been accumulated
        if let ProposalState::Draft { amount_staked } = self.proposal.state {
            require_gte!(
                amount_staked,
                self.dao.base_to_stake,
                AutocratError::InsufficientStakeToLaunch
            );
        }

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
            return Err(AutocratError::PoolNotInSpotState.into());
        };

        let base_to_lp = spot.base_reserves / 2;
        let quote_to_lp = spot.quote_reserves / 2;

        spot.base_reserves -= base_to_lp;
        spot.quote_reserves -= quote_to_lp;

        require_gte!(
            base_to_lp,
            dao.min_base_futarchic_liquidity,
            AutocratError::InsufficientLiquidity
        );
        require_gte!(
            quote_to_lp,
            dao.min_quote_futarchic_liquidity,
            AutocratError::InsufficientLiquidity
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
                    clock.slot,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_slots,
                ),
            },
            fail: Pool {
                base_reserves: base_to_lp,
                quote_reserves: quote_to_lp,
                quote_protocol_fee_balance: 0,
                base_protocol_fee_balance: 0,
                oracle: TwapOracle::new(
                    clock.slot,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_slots,
                ),
            },
        };

        // Update proposal state to Pending
        proposal.state = ProposalState::Pending;

        emit_cpi!(LaunchProposalEvent {
            common: CommonFields::new(&clock),
            proposal: proposal.key(),
            dao: dao.key(),
            total_staked,
        });

        Ok(())
    }
}
