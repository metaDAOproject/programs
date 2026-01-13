use super::*;

pub const SEED_CONDITIONAL_VAULT: &[u8] = b"conditional_vault";
pub const SEED_CONDITIONAL_TOKEN: &[u8] = b"conditional_token";

#[account]
#[derive(InitSpace)]
pub struct ConditionalVault {
    pub question: Pubkey,
    pub underlying_token_mint: Pubkey,
    pub underlying_token_account: Pubkey,
    // It is up to the initializer to increase the space of the account to include the conditional token mints.
    #[max_len(0)]
    pub conditional_token_mints: Vec<Pubkey>,
    pub pda_bump: u8,
    pub decimals: u8,
    pub seq_num: u64,
}

impl ConditionalVault {
    /// Checks that the vault's assets are always greater than or equal to its potential
    /// liabilities. Should be called anytime you mint or burn conditional tokens.
    ///
    /// `conditional_token_supplies` should be in the same order as
    /// `vault.conditional_token_mints`.
    pub fn invariant(
        &self,
        question: &Question,
        conditional_token_supplies: Vec<u64>,
        vault_underlying_balance: u64,
    ) -> Result<()> {
        // if the question isn't resolved, the vault should have more than or equal to underlying
        // tokens than ANY conditional token mint's supply

        // if the question is resolved, the vault should have more than or equal to underlying
        // tokens than the sum of the conditional token mint's supplies multiplied
        // by their respective payouts

        let max_possible_liability = if !question.is_resolved() {
            // safe because conditional_token_supplies is non-empty
            *conditional_token_supplies.iter().max().unwrap()
        } else {
            // Sum all numerators first, then divide once
            let total_numerator: u128 = conditional_token_supplies
                .iter()
                .enumerate()
                .map(|(i, supply)| *supply as u128 * question.payout_numerators[i] as u128)
                .sum();

            (total_numerator / question.payout_denominator as u128) as u64
        };

        require_gte!(
            vault_underlying_balance,
            max_possible_liability,
            VaultError::AssertFailed
        );

        Ok(())
    }
}

#[macro_export]
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            SEED_CONDITIONAL_VAULT,
            $vault.question.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &[$vault.pda_bump],
        ]
    }};
}
