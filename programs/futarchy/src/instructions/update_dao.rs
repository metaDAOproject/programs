use super::*;

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct UpdateDaoParams {
    pub pass_threshold_bps: Option<u16>,
    pub seconds_per_proposal: Option<u32>,
    pub twap_initial_observation: Option<u128>,
    pub twap_max_observation_change_per_update: Option<u128>,
    pub twap_start_delay_seconds: Option<u32>,
    pub min_quote_futarchic_liquidity: Option<u64>,
    pub min_base_futarchic_liquidity: Option<u64>,
    pub base_to_stake: Option<u64>,
    pub team_sponsored_pass_threshold_bps: Option<i16>,
    pub team_address: Option<Pubkey>,
    pub is_optimistic_governance_enabled: Option<bool>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct UpdateDao<'info> {
    #[account(mut, has_one = squads_multisig_vault)]
    pub dao: Account<'info, Dao>,
    pub squads_multisig_vault: Signer<'info>,
}

impl UpdateDao<'_> {
    pub fn validate(&self) -> Result<()> {
        // Prevent parameter updates during active futarchy markets
        if !matches!(self.dao.amm.state, PoolState::Spot { .. }) {
            return Err(FutarchyError::PoolNotInSpotState.into());
        }
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, dao_params: UpdateDaoParams) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.set_inner(Dao {
            amm: dao.amm.clone(),
            nonce: dao.nonce,
            dao_creator: dao.dao_creator,
            pda_bump: dao.pda_bump,
            squads_multisig: dao.squads_multisig,
            squads_multisig_vault: dao.squads_multisig_vault,
            base_mint: dao.base_mint,
            quote_mint: dao.quote_mint,
            proposal_count: dao.proposal_count,
            pass_threshold_bps: dao_params
                .pass_threshold_bps
                .unwrap_or(dao.pass_threshold_bps),
            seconds_per_proposal: dao_params
                .seconds_per_proposal
                .unwrap_or(dao.seconds_per_proposal),
            twap_initial_observation: dao_params
                .twap_initial_observation
                .unwrap_or(dao.twap_initial_observation),
            twap_max_observation_change_per_update: dao_params
                .twap_max_observation_change_per_update
                .unwrap_or(dao.twap_max_observation_change_per_update),
            twap_start_delay_seconds: dao_params
                .twap_start_delay_seconds
                .unwrap_or(dao.twap_start_delay_seconds),
            min_quote_futarchic_liquidity: dao_params
                .min_quote_futarchic_liquidity
                .unwrap_or(dao.min_quote_futarchic_liquidity),
            min_base_futarchic_liquidity: dao_params
                .min_base_futarchic_liquidity
                .unwrap_or(dao.min_base_futarchic_liquidity),
            base_to_stake: dao_params.base_to_stake.unwrap_or(dao.base_to_stake),
            seq_num: dao.seq_num,
            initial_spending_limit: dao.initial_spending_limit.clone(),
            team_sponsored_pass_threshold_bps: dao_params
                .team_sponsored_pass_threshold_bps
                .unwrap_or(dao.team_sponsored_pass_threshold_bps),
            team_address: dao_params.team_address.unwrap_or(dao.team_address),
            optimistic_proposal: dao.optimistic_proposal.clone(),
            is_optimistic_governance_enabled: dao_params
                .is_optimistic_governance_enabled
                .unwrap_or(dao.is_optimistic_governance_enabled),
        });

        dao.seq_num += 1;

        dao.invariant()?;

        let clock = Clock::get()?;
        emit_cpi!(UpdateDaoEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            pass_threshold_bps: dao.pass_threshold_bps,
            seconds_per_proposal: dao.seconds_per_proposal,
            twap_initial_observation: dao.twap_initial_observation,
            twap_max_observation_change_per_update: dao.twap_max_observation_change_per_update,
            twap_start_delay_seconds: dao.twap_start_delay_seconds,
            min_quote_futarchic_liquidity: dao.min_quote_futarchic_liquidity,
            min_base_futarchic_liquidity: dao.min_base_futarchic_liquidity,
            base_to_stake: dao.base_to_stake,
            team_sponsored_pass_threshold_bps: dao.team_sponsored_pass_threshold_bps,
            team_address: dao.team_address,
            is_optimistic_governance_enabled: dao.is_optimistic_governance_enabled,
        });

        Ok(())
    }
}
