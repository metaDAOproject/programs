import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { assertVaultTransactionPayload } from "../../utils.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

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
            amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });
  });

  it("bakes the IP-transfer memo into the Squads payload", async function () {
    const liquidator = Keypair.generate().publicKey;

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    // The payload is ceremony: a memo touches no accounts, so the immutable
    // Squads transaction cannot fail on any DAO configuration. The state flip
    // happens at finalize; the liquidator unwinds through the estate cycle.
    const expectedMemoIx = new TransactionInstruction({
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      keys: [],
      data: Buffer.from(
        "Intellectual property transferred to the DAO upon initialization will be transferred back to the original team.",
        "utf8",
      ),
    });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedMemoIx,
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isNull(storedProposal.sponsoredBy);
    assert.ok(
      storedProposal.action.hostileLiquidate.liquidator.equals(liquidator),
    );

    // 10 days, +25%, blockable
    assert.equal(storedProposal.durationInSeconds, 864_000);
    assert.equal(storedProposal.passThresholdBps, 2500);
    assert.isTrue(storedProposal.councilCanBlock);

    const updatedDao = await this.futarchy.getDao(dao);
    assert.equal(updatedDao.proposalCount, 1);
  });
}
