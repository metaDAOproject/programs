import { getDaoAddr, PERMISSIONLESS_ACCOUNT, PriceMath } from "@metadaoproject/futarchy/v0.5";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { ONE_MINUTE_IN_SLOTS } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);
  });

  it("should initialize a DAO", async function () {
    await this.autocratClient.initializeDaoIx({
      baseMint: META,
      quoteMint: USDC,
      params: {
        slotsPerProposal: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24 * 3),
        twapStartDelaySlots: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24),
        twapInitialObservation: THOUSAND_BUCK_PRICE,
        twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
        minQuoteFutarchicLiquidity: new BN(1),
        minBaseFutarchicLiquidity: new BN(1000),
        passThresholdBps: 300,
        nonce: new BN(1337),
      },
    }).rpc();

    const [dao, daoBump] = getDaoAddr({ nonce: new BN(1337) });

    const storedDao = await this.autocratClient.getDao(dao);

    assert.ok(storedDao.baseMint.equals(META));
    assert.ok(storedDao.quoteMint.equals(USDC));
    assert.equal(storedDao.pdaBump, daoBump);
    assert.equal(storedDao.proposalCount, 0);

    assert.equal(storedDao.nonce.toString(), "1337");
    assert.equal(storedDao.slotsPerProposal.toString(), new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24 * 3).toString());
    assert.equal(storedDao.twapStartDelaySlots.toString(), new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24).toString());
    assert.equal(storedDao.twapInitialObservation.toString(), THOUSAND_BUCK_PRICE.toString());
    assert.equal(storedDao.twapMaxObservationChangePerUpdate.toString(), THOUSAND_BUCK_PRICE.divn(100).toString());
    assert.equal(storedDao.minQuoteFutarchicLiquidity.toString(), "1");
    assert.equal(storedDao.minBaseFutarchicLiquidity.toString(), "1000");
    assert.equal(storedDao.passThresholdBps, 300);

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    assert.ok(storedDao.squadsMultisig.equals(multisigPda));
    assert.ok(storedDao.squadsMultisigVault.equals(squadsMultisigVault));

    const storedMultisig = await multisig.accounts.Multisig.fromAccountAddress(this.squadsConnection, multisigPda);
    assert.ok(storedMultisig.configAuthority.equals(dao));
    assert.equal(storedMultisig.threshold, 1);
    assert.equal(storedMultisig.timeLock, 0);
    assert.equal(storedMultisig.transactionIndex.toString(), "0");

    let daoMember = storedMultisig.members.find((member) => member.key.equals(dao));
    assert.ok(daoMember);
    assert.equal(daoMember.permissions.mask, Permissions.fromPermissions([Permission.Vote]).mask);

    let permissionlessMember = storedMultisig.members.find((member) => member.key.equals(PERMISSIONLESS_ACCOUNT.publicKey));
    assert.ok(permissionlessMember);
    assert.equal(permissionlessMember.permissions.mask, Permissions.fromPermissions([Permission.Initiate, Permission.Execute]).mask);
  });
}