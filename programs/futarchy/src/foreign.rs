use anchor_lang::prelude::*;
use std::ops::Deref;

/// Wraps an account owned by another Anchor program so it can be used with `Account` without being listed in this program's IDL.
#[derive(Clone)]
pub struct Foreign<T>(pub T);

impl<T> Deref for Foreign<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

impl<T: AccountDeserialize> AccountDeserialize for Foreign<T> {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        T::try_deserialize(buf).map(Foreign)
    }
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        T::try_deserialize_unchecked(buf).map(Foreign)
    }
}

impl<T: AccountSerialize> AccountSerialize for Foreign<T> {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> Result<()> {
        self.0.try_serialize(writer)
    }
}

impl<T: Owner> Owner for Foreign<T> {
    fn owner() -> Pubkey {
        T::owner()
    }
}

impl<T: Discriminator> Discriminator for Foreign<T> {
    const DISCRIMINATOR: &'static [u8] = T::DISCRIMINATOR;
}

#[cfg(feature = "idl-build")]
impl<T> anchor_lang::IdlBuild for Foreign<T> {}

// `#[derive(Accounts)]` needs a plain type path, so the wrapper is used through aliases.
pub type SquadsMultisig = Foreign<squads_multisig_program::Multisig>;
pub type SquadsProposal = Foreign<squads_multisig_program::Proposal>;
pub type SquadsVaultTransaction = Foreign<squads_multisig_program::VaultTransaction>;
pub type SquadsSpendingLimit = Foreign<squads_multisig_program::SpendingLimit>;
