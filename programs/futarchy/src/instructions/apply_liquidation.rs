use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct ApplyLiquidation<'info> {
    /// The linked liquidation proposal, baked into the payload at create.
    #[account(has_one = dao)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, has_one = squads_multisig_vault)]
    pub dao: Box<Account<'info, Dao>>,
    /// The vault's signature is only obtainable through a Squads vault
    /// transaction execution, so the caller is a passed proposal's payload.
    pub squads_multisig_vault: Signer<'info>,
    /// CHECK: the treasury's own LP position. The address is pinned by the
    /// seeds, but whether the account exists at execution is unknowable at
    /// create, so it is parsed manually — a passed liquidation must never
    /// brick on treasury shape.
    #[account(
        mut,
        seeds = [SEED_AMM_POSITION, dao.key().as_ref(), squads_multisig_vault.key().as_ref()],
        bump,
    )]
    pub amm_position: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = dao,
    )]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = dao.quote_mint,
        associated_token::authority = dao,
    )]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = squads_multisig_vault,
    )]
    pub vault_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = dao.quote_mint,
        associated_token::authority = squads_multisig_vault,
    )]
    pub vault_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl ApplyLiquidation<'_> {
    pub fn validate(&self) -> Result<()> {
        // Like every payload instruction that mutates the DAO, only lands in
        // Spot — the sweep always computes against a whole spot pool.
        require!(
            matches!(self.dao.amm.state, PoolState::Spot { .. }),
            FutarchyError::PoolNotInSpotState
        );

        require!(
            self.proposal.state == ProposalState::Passed,
            FutarchyError::ProposalNotPassed
        );

        // Only a proposal with a hostile liquidation action can be applied.
        let ProposalAction::HostileLiquidate { liquidator } = &self.proposal.action else {
            return err!(FutarchyError::InvalidProposalKind);
        };

        // The liquidator must be the same as the one set by finalize_proposal.
        require!(
            self.dao.liquidator == Some(*liquidator),
            FutarchyError::InvalidLiquidator
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            proposal,
            dao,
            squads_multisig_vault: _,
            amm_position,
            amm_base_vault,
            amm_quote_vault,
            vault_base_account,
            vault_quote_account,
            token_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let ProposalAction::HostileLiquidate { liquidator } = &proposal.action else {
            return err!(FutarchyError::InvalidProposalKind);
        };
        let liquidator = *liquidator;

        // Zero the record; the next sync removes the Squads-side limit, so
        // the outgoing team's pull rights end.
        dao.initial_spending_limit = None;
        dao.spending_limit_dirty = true;

        // Sweep the treasury's own AMM position pro-rata into the vault's
        // token accounts. Third-party positions are untouched — they exit on
        // their own schedule via withdraw_liquidity. A missing or empty
        // position is skipped, never a failure.
        let mut base_swept = 0u64;
        let mut quote_swept = 0u64;

        if !amm_position.data_is_empty() {
            require_keys_eq!(
                *amm_position.owner,
                crate::ID,
                anchor_lang::error::ErrorCode::AccountOwnedByWrongProgram
            );

            let mut position: AmmPosition = {
                let data = amm_position.try_borrow_data()?;
                AmmPosition::try_deserialize(&mut &data[..])?
            };

            if position.liquidity > 0 {
                let liquidity_to_sweep = position.liquidity;
                (base_swept, quote_swept) = withdraw_from_position(
                    dao,
                    &mut position,
                    liquidity_to_sweep,
                    amm_base_vault,
                    amm_quote_vault,
                    vault_base_account,
                    vault_quote_account,
                    token_program,
                )?;

                // The position sits behind an UncheckedAccount, so Anchor
                // won't write it back on exit — persist it manually.
                {
                    let mut data = amm_position.try_borrow_mut_data()?;
                    let mut writer: &mut [u8] = &mut data;
                    position.try_serialize(&mut writer)?;
                }
            }
        }

        dao.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(ApplyLiquidationEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            proposal: proposal.key(),
            liquidator,
            base_swept,
            quote_swept,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
