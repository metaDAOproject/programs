use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct LaunchProposal<'info> {
    #[account(mut)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub futarchy_amm: Box<Account<'info, FutarchyAmm>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
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
            futarchy_amm,
            proposal,
            dao,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        // Get the total staked amount
        let total_staked = match proposal.state {
            ProposalState::Draft { amount_staked } => amount_staked,
            _ => unreachable!(),
        };

        // Set up the futarchy AMM by splitting the spot pool reserves
        let PoolState::Spot { mut spot } = futarchy_amm.state.to_owned() else { unreachable!() };

        let half_base = spot.base_reserves / 2;
        let half_quote = spot.quote_reserves / 2;

        spot.base_reserves -= half_base;
        spot.quote_reserves -= half_quote;

        let clock = Clock::get()?;

        futarchy_amm.state = PoolState::Futarchy {
            spot,
            pass: Pool {
                base_reserves: half_base,
                quote_reserves: half_quote,
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
                base_reserves: half_base,
                quote_reserves: half_quote,
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
