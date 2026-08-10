use super::*;

pub const DAY_SECONDS: u32 = 24 * 60 * 60;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct InstructionParams {
    pub duration_seconds: u32,
    /// Signed: a negative threshold lets a proposal pass even when the pass
    /// price is below the fail price.
    pub pass_threshold_bps: i16,
    /// Launch condition: the proposal must be team-sponsored to launch.
    pub requires_team_sponsorship: bool,
    pub council_can_block: bool,
    /// Cooldown checked at launch. 0 = none.
    pub cooldown_seconds: u32,
    /// Delay before the conditional TWAPs start to accumulate
    pub twap_start_delay_seconds: u32,
}

/// What a hostile takeover declares for the spending limit.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum SpendingLimitAction {
    Keep,
    Remove,
    Set(InitialSpendingLimit),
}

/// The typed action parameters, stored on the proposal. The borsh variant tag
/// is the proposal's kind discriminator, so variants are append-only — the
/// variant index is the wire tag.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum ProposalAction {
    LargeSpend {
        amount: u64,
    },
    MintTokens {
        amount: u64,
        recipient: Pubkey,
    },
    /// `Some` = replace the spending limit, `None` = remove it.
    SpendingLimitChange {
        config: Option<InitialSpendingLimit>,
    },
    ExecuteArbitrary,
    HostileTakeover {
        new_team_address: Pubkey,
        spending_limit_action: SpendingLimitAction,
    },
    HostileLiquidate {
        liquidator: Pubkey,
    },
    BuybackToken {
        /// Total quote to deploy. Capped at 25% of the treasury.
        quote_amount: u64,
        quote_amount_per_cycle: u64,
        /// Seconds between orders.
        cycle_frequency_seconds: u32,
        /// Seconds after execution before the first order. 0 = immediately.
        start_delay_seconds: u32,
        /// Optional price band, in quote native units per whole base token:
        /// 1_600_000 = 1.6 USDC per token.
        /// `None` = unguarded.
        min_price: Option<u64>,
        max_price: Option<u64>,
    },
}

impl ProposalAction {
    /// The protocol-wide parameters of each proposal kind. Hardcoded: there is
    /// no per-DAO tuning.
    pub fn params(&self) -> InstructionParams {
        match self {
            ProposalAction::LargeSpend { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 3 / 2, // 1.5 days
                pass_threshold_bps: -1000,
                requires_team_sponsorship: true,
                council_can_block: true,
                cooldown_seconds: 0,
                twap_start_delay_seconds: DAY_SECONDS / 2,
            },
            ProposalAction::MintTokens { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 5,
                pass_threshold_bps: 500,
                requires_team_sponsorship: false,
                council_can_block: true,
                cooldown_seconds: 0,
                twap_start_delay_seconds: DAY_SECONDS,
            },
            ProposalAction::SpendingLimitChange { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 5,
                pass_threshold_bps: 500,
                requires_team_sponsorship: true,
                council_can_block: true,
                cooldown_seconds: 0,
                twap_start_delay_seconds: DAY_SECONDS,
            },
            ProposalAction::ExecuteArbitrary => InstructionParams {
                duration_seconds: DAY_SECONDS * 10,
                pass_threshold_bps: 1000,
                requires_team_sponsorship: false,
                council_can_block: true,
                cooldown_seconds: 0,
                twap_start_delay_seconds: DAY_SECONDS,
            },
            ProposalAction::HostileTakeover { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 20,
                pass_threshold_bps: 1000,
                requires_team_sponsorship: false,
                council_can_block: false,
                cooldown_seconds: DAY_SECONDS * 20,
                twap_start_delay_seconds: DAY_SECONDS,
            },
            ProposalAction::HostileLiquidate { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 10,
                pass_threshold_bps: 2500,
                requires_team_sponsorship: false,
                council_can_block: false,
                cooldown_seconds: DAY_SECONDS * 10,
                twap_start_delay_seconds: DAY_SECONDS,
            },
            ProposalAction::BuybackToken { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 10,
                pass_threshold_bps: 1000,
                requires_team_sponsorship: false,
                council_can_block: true,
                cooldown_seconds: DAY_SECONDS * 90,
                twap_start_delay_seconds: DAY_SECONDS,
            },
        }
    }

    /// Per-kind launch gates over caller-supplied accounts, hooked in by
    /// `launch_proposal`. Kinds with no account gate require an empty list.
    pub fn verify_launch_accounts<'info>(
        &self,
        dao: &Account<'info, Dao>,
        accounts: &'info [AccountInfo<'info>],
    ) -> Result<()> {
        match self {
            ProposalAction::BuybackToken { quote_amount, .. } => {
                verify_buyback_treasury_cap(*quote_amount, dao, accounts)
            }
            _ => {
                require_eq!(
                    accounts.len(),
                    0,
                    FutarchyError::UnexpectedLaunchAccounts
                );
                Ok(())
            }
        }
    }
}

/// The 25% treasury cap, measured from the supplied account list. Launch is
/// permissionless, so the list is considered adversarial input.
fn verify_buyback_treasury_cap<'info>(
    quote_amount: u64,
    dao: &Account<'info, Dao>,
    treasury_accounts: &'info [AccountInfo<'info>],
) -> Result<()> {
    let PoolState::Spot { ref spot } = dao.amm.state else {
        return err!(FutarchyError::PoolNotInSpotState);
    };

    // The treasury's own AMM position sits at its derived PDA, so at most
    // one account in existence can pass this check.
    let (position_pda, _) = Pubkey::find_program_address(
        &[
            SEED_AMM_POSITION,
            dao.key().as_ref(),
            dao.squads_multisig_vault.as_ref(),
        ],
        &crate::ID,
    );

    let mut treasury_quote: u128 = 0;
    let mut previous_key: Option<Pubkey> = None;

    for account in treasury_accounts {
        // Strictly ascending keys prove uniqueness.
        if let Some(previous_key) = previous_key {
            require_gt!(
                account.key(),
                previous_key,
                FutarchyError::TreasuryAccountsNotSorted
            );
        }
        previous_key = Some(account.key());

        if account.owner == &token::ID {
            // Any vault-owned quote account counts.
            let token_account = Account::<TokenAccount>::try_from(account)?;
            require_keys_eq!(
                token_account.mint,
                dao.quote_mint,
                FutarchyError::InvalidTreasuryAccount
            );
            require_keys_eq!(
                token_account.owner,
                dao.squads_multisig_vault,
                FutarchyError::InvalidTreasuryAccount
            );
            treasury_quote += token_account.amount as u128;
        } else if account.owner == &crate::ID {
            let position = Account::<AmmPosition>::try_from(account)?;
            require_keys_eq!(
                account.key(),
                position_pda,
                FutarchyError::InvalidTreasuryAccount
            );
            // The address already binds these fields, but keep it explicit.
            require_keys_eq!(
                position.dao,
                dao.key(),
                FutarchyError::InvalidTreasuryAccount
            );
            require_keys_eq!(
                position.position_authority,
                dao.squads_multisig_vault,
                FutarchyError::InvalidTreasuryAccount
            );
            // The quote a withdrawal would deliver right now.
            if dao.amm.total_liquidity > 0 {
                treasury_quote += spot
                    .get_quote_withdrawable(position.liquidity, dao.amm.total_liquidity)
                    as u128;
            }
        } else {
            return err!(FutarchyError::InvalidTreasuryAccount);
        }
    }

    require_gte!(
        treasury_quote,
        quote_amount as u128 * 4,
        FutarchyError::BuybackCapExceeded
    );

    Ok(())
}
