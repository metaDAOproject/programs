import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import {
  assertVaultTransactionPayload,
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
  setupBasicDao,
} from "../../utils.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

// 1,000 USDC per month => 3,000 USDC cap
const AMOUNT_PER_MONTH = new BN(1_000_000_000);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: ONE_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: ONE_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: AMOUNT_PER_MONTH,
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 0,
          teamAddress: this.payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });
  });

  it("bakes exactly one vault-to-team transfer and snapshots the kind's params", async function () {
    // exactly 3x the monthly limit: the cap is inclusive
    const amount = AMOUNT_PER_MONTH.muln(3);

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeLargeSpendProposal({ dao, amount });

    const storedDao = await this.futarchy.getDao(dao);

    // the recipient is the team's quote ATA, pinned at create
    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      createTransferInstruction(
        getAssociatedTokenAddressSync(
          USDC,
          storedDao.squadsMultisigVault,
          true,
        ),
        getAssociatedTokenAddressSync(USDC, this.payer.publicKey, true),
        storedDao.squadsMultisigVault,
        BigInt(amount.toString()),
      ),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isNull(storedProposal.sponsoredBy);

    assert.equal(
      storedProposal.action.largeSpend.amount.toString(),
      amount.toString(),
    );
    assert.ok(
      storedProposal.action.largeSpend.teamAddress.equals(this.payer.publicKey),
    );
    assert.equal(storedProposal.durationInSeconds, 129_600);
    assert.equal(storedProposal.passThresholdBps, -1000);
    assert.isTrue(storedProposal.councilCanBlock);

    assert.equal(storedDao.proposalCount, 1);
  });

  it("throws error when the DAO has no spending limit", async function () {
    const noRecordDao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    const callbacks = expectError(
      "NoSpendingLimit",
      "created a large spend proposal without a spending limit",
    );
    await this.futarchy
      .initializeLargeSpendProposal({ dao: noRecordDao, amount: new BN(1) })
      .then(...callbacks);
  });

  it("throws error when the amount exceeds 3x the monthly limit", async function () {
    const callbacks = expectError(
      "SpendCapExceeded",
      "created a large spend proposal above the cap",
    );
    await this.futarchy
      .initializeLargeSpendProposal({
        dao,
        amount: AMOUNT_PER_MONTH.muln(3).addn(1),
      })
      .then(...callbacks);
  });

  it("the transfer payload executes once the Squads proposal is approved", async function () {
    const amount = AMOUNT_PER_MONTH.muln(3);

    const { squadsProposal, squadsTransaction } =
      await this.futarchy.initializeLargeSpendProposal({ dao, amount });

    const storedDao = await this.futarchy.getDao(dao);

    // fund the treasury ATA the payload pulls from
    const vaultBalanceBefore = await this.getTokenBalance(
      USDC,
      storedDao.squadsMultisigVault,
    );
    await this.mintTo(
      USDC,
      storedDao.squadsMultisigVault,
      this.payer,
      amount.toNumber(),
    );

    // the team is the payer
    const teamBalanceBefore = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );

    await forceApproveSquadsProposal(this, squadsProposal);
    await executeVaultTransaction(this, dao, squadsTransaction);

    const teamBalanceAfter = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    assert.equal(
      (teamBalanceAfter - teamBalanceBefore).toString(),
      amount.toString(),
    );
    // the vault paid out exactly what we funded
    assert.equal(
      (
        await this.getTokenBalance(USDC, storedDao.squadsMultisigVault)
      ).toString(),
      vaultBalanceBefore.toString(),
    );
  });
}
