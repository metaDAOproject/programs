import {
  getDaoAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.6";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission, Period } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);
  });

  it("should initialize a DAO", async function () {
    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1000),
          baseToStake: new BN(1000),
          passThresholdBps: 300,
          nonce: new BN(1337),
          initialSpendingLimit: null,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao, daoBump] = getDaoAddr({
      nonce: new BN(1337),
      daoCreator: this.payer.publicKey,
    });

    const storedDao = await this.futarchy.getDao(dao);

    assert.ok(storedDao.baseMint.equals(META));
    assert.ok(storedDao.quoteMint.equals(USDC));
    assert.equal(storedDao.pdaBump, daoBump);
    assert.equal(storedDao.proposalCount, 0);

    assert.equal(storedDao.nonce.toString(), "1337");
    assert.equal(storedDao.secondsPerProposal, 60 * 60 * 24 * 3);
    assert.equal(storedDao.twapStartDelaySeconds, 60 * 60 * 24);
    assert.equal(
      storedDao.twapInitialObservation.toString(),
      THOUSAND_BUCK_PRICE.toString()
    );
    assert.equal(
      storedDao.twapMaxObservationChangePerUpdate.toString(),
      THOUSAND_BUCK_PRICE.divn(100).toString()
    );
    assert.equal(storedDao.minQuoteFutarchicLiquidity.toString(), "1");
    assert.equal(storedDao.minBaseFutarchicLiquidity.toString(), "1000");
    assert.equal(storedDao.passThresholdBps, 300);
    assert.isNull(storedDao.initialSpendingLimit);

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    assert.ok(storedDao.squadsMultisig.equals(multisigPda));
    assert.ok(storedDao.squadsMultisigVault.equals(squadsMultisigVault));

    const storedMultisig = await multisig.accounts.Multisig.fromAccountAddress(
      this.squadsConnection,
      multisigPda
    );
    assert.ok(storedMultisig.configAuthority.equals(dao));
    assert.equal(storedMultisig.threshold, 1);
    assert.equal(storedMultisig.timeLock, 0);
    assert.equal(storedMultisig.transactionIndex.toString(), "0");

    const daoMember = storedMultisig.members.find((member) =>
      member.key.equals(dao)
    );
    assert.ok(daoMember);
    assert.equal(
      daoMember.permissions.mask,
      Permissions.fromPermissions([Permission.Vote]).mask
    );

    const permissionlessMember = storedMultisig.members.find((member) =>
      member.key.equals(PERMISSIONLESS_ACCOUNT.publicKey)
    );
    assert.ok(permissionlessMember);
    assert.equal(
      permissionlessMember.permissions.mask,
      Permissions.fromPermissions([Permission.Initiate, Permission.Execute])
        .mask
    );
  });

  it("should initialize a DAO with an initial spending limit", async function () {
    const spender = Keypair.generate();

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1000),
          baseToStake: new BN(1000),
          passThresholdBps: 300,
          nonce: new BN(420),
          initialSpendingLimit: {
            // 10k per month burn
            amountPerMonth: new BN(10_000 * 10 ** 6),
            members: [spender.publicKey],
          },
        },
      })
      .rpc();

    const [dao] = getDaoAddr({
      nonce: new BN(420),
      daoCreator: this.payer.publicKey,
    });

    const storedDao = await this.futarchy.getDao(dao);

    assert.exists(storedDao.initialSpendingLimit);
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      "10000000000"
    );
    assert.equal(storedDao.initialSpendingLimit.members.length, 1);
    assert.ok(
      storedDao.initialSpendingLimit.members[0].equals(spender.publicKey)
    );

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const spendingLimitPda = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    const storedSpendingLimit =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        this.squadsConnection,
        spendingLimitPda
      );

    assert.ok(storedSpendingLimit.multisig.equals(multisigPda));
    assert.ok(storedSpendingLimit.createKey.equals(dao));
    assert.equal(storedSpendingLimit.vaultIndex, 0);
    assert.ok(storedSpendingLimit.mint.equals(USDC));
    assert.equal(storedSpendingLimit.amount.toString(), "10000000000");
    assert.equal(storedSpendingLimit.remainingAmount.toString(), "10000000000");
    assert.equal(storedSpendingLimit.period, Period.Month);
    assert.equal(storedSpendingLimit.members.length, 1);
    assert.ok(storedSpendingLimit.members[0].equals(spender.publicKey));
    assert.equal(storedSpendingLimit.destinations.length, 0);
  });

  it("doesn't allow DAOs with proposal duration less than TWAP start delay", async function () {
    const callbacks = expectError(
      "ProposalDurationTooShort",
      "DAO initialized despite slots_per_proposal being less than twap_start_delay_slots"
    );

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          twapInitialObservation: new BN(1),
          twapMaxObservationChangePerUpdate: new BN(1000),
          twapStartDelaySeconds: 10000,
          minQuoteFutarchicLiquidity: new BN(5),
          minBaseFutarchicLiquidity: new BN(5000),
          passThresholdBps: 300,
          secondsPerProposal: 5000,
          nonce: new BN(1338),
          initialSpendingLimit: null,
        },
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
