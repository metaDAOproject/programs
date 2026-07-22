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
        // Spot — the sweep always computes against a whole spot pool. A
        // mid-market execution reverts whole and stays retryable: the
        // approved Squads transaction lands once that market finalizes.
        require!(
            matches!(self.dao.amm.state, PoolState::Spot { .. }),
            FutarchyError::PoolNotInSpotState
        );

        require!(
            self.proposal.state == ProposalState::Passed,
            FutarchyError::ProposalNotPassed
        );

        // Execution is permissionless and a second passed liquidation can
        // exist, so replay must be refused, not double-applied.
        require!(
            self.dao.liquidator.is_none(),
            FutarchyError::AlreadyLiquidated
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

        // The destructure is the kind check: the vault's signature alone is
        // kind-blind, so without it an execute_arbitrary payload could invoke
        // liquidation at 10 days / +10% blockable.
        let ProposalAction::HostileLiquidate { liquidator } = &proposal.action else {
            return err!(FutarchyError::InvalidProposalKind);
        };
        let liquidator = *liquidator;

        // `Some` is the liquidated flag, and it is terminal.
        dao.liquidator = Some(liquidator);

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
                let total_liquidity = dao.amm.total_liquidity;
                require_gt!(total_liquidity, 0, FutarchyError::AssertFailed);

                {
                    let PoolState::Spot { ref mut spot } = dao.amm.state else {
                        return err!(FutarchyError::PoolNotInSpotState);
                    };

                    let (base_to_sweep, quote_to_sweep) =
                        spot.get_base_and_quote_withdrawable(liquidity_to_sweep, total_liquidity);
                    spot.base_reserves -= base_to_sweep;
                    spot.quote_reserves -= quote_to_sweep;

                    base_swept = base_to_sweep;
                    quote_swept = quote_to_sweep;
                }

                dao.amm.total_liquidity -= liquidity_to_sweep;

                position.liquidity = 0;
                {
                    let mut data = amm_position.try_borrow_mut_data()?;
                    let mut writer: &mut [u8] = &mut data;
                    position.try_serialize(&mut writer)?;
                }

                let dao_creator = dao.dao_creator;
                let nonce = dao.nonce.to_le_bytes();
                let signer_seeds = &[
                    SEED_DAO,
                    dao_creator.as_ref(),
                    nonce.as_ref(),
                    &[dao.pda_bump],
                ];

                for (amount_to_sweep, from, to) in [
                    (base_swept, amm_base_vault, vault_base_account),
                    (quote_swept, amm_quote_vault, vault_quote_account),
                ] {
                    token::transfer(
                        CpiContext::new_with_signer(
                            token_program.to_account_info(),
                            Transfer {
                                from: from.to_account_info(),
                                to: to.to_account_info(),
                                authority: dao.to_account_info(),
                            },
                            &[&signer_seeds[..]],
                        ),
                        amount_to_sweep,
                    )?;
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
