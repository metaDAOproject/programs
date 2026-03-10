use crate::FuzzTest;
use trident_fuzz::fuzzing::Signer;

impl FuzzTest {
    pub fn assert_global_invariants(&mut self) {
        let governor = self.read_governor();
        assert_eq!(governor.mint, self.mint);
        assert_eq!(governor.createKey, self.create_key.pubkey());
        assert_eq!(governor.admin, self.payer.pubkey());

        let account = self.read_mint_authority(self.authorized_minter.pubkey());
        if !self.minter_exists {
            assert!(
                account.is_none(),
                "inactive mint authority should not exist"
            );
            return;
        }

        let account = account.expect("mint authority should exist");
        assert_eq!(account.mintGovernor, self.mint_governor);
        assert_eq!(account.authorizedMinter, self.authorized_minter.pubkey());
        assert_eq!(account.maxTotal, self.expected_max_total);
        assert_eq!(account.totalMinted, self.expected_total_minted);
    }
}
