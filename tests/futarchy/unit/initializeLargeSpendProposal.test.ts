import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { expectError, setupBasicDao } from "../../utils.js";

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

    const vaultTransaction =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        squadsTransaction,
      );
    const message = vaultTransaction.message;

    assert.equal(message.instructions.length, 1);
    // the Squads vault is the inner transaction's only signer
    assert.equal(message.numSigners, 1);
    assert.ok(message.accountKeys[0].equals(storedDao.squadsMultisigVault));

    const [transferIx] = message.instructions;
    assert.ok(
      message.accountKeys[transferIx.programIdIndex].equals(TOKEN_PROGRAM_ID),
    );

    const accounts = [...transferIx.accountIndexes].map(
      (index) => message.accountKeys[index],
    );
    assert.equal(accounts.length, 3);
    assert.ok(
      accounts[0].equals(
        getAssociatedTokenAddressSync(
          USDC,
          storedDao.squadsMultisigVault,
          true,
        ),
      ),
    );
    assert.ok(
      accounts[1].equals(
        getAssociatedTokenAddressSync(USDC, this.payer.publicKey, true),
      ),
    );
    assert.ok(accounts[2].equals(storedDao.squadsMultisigVault));

    // SPL transfer data: tag 3 + u64 LE amount
    const data = Buffer.from(transferIx.data);
    assert.equal(data.length, 9);
    assert.equal(data[0], 3);
    assert.equal(new BN(data.subarray(1), "le").toString(), amount.toString());

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isFalse(storedProposal.isTeamSponsored);

    assert.equal(
      storedProposal.action.largeSpend.amount.toString(),
      amount.toString(),
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
}
