use crate::FuzzTest;
use trident_fuzz::fuzzing::Signer;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn invariant_global_invariants(&mut self) {
        let governor = self.read_governor();
        invariant_eq!(governor.mint, self.mint);
        invariant_eq!(governor.createKey, self.create_key.pubkey());
        invariant_eq!(governor.admin, self.payer.pubkey());

        let account = self.read_mint_authority(self.authorized_minter.pubkey());
        if !self.minter_exists {
            invariant!(
                account.is_none(),
                "inactive mint authority should not exist"
            );
            return;
        }

        let account = account.expect("mint authority should exist");
        invariant_eq!(account.mintGovernor, self.mint_governor);
        invariant_eq!(account.authorizedMinter, self.authorized_minter.pubkey());
        invariant_eq!(account.maxTotal, self.expected_max_total);
        invariant_eq!(account.totalMinted, self.expected_total_minted);
    }
}
