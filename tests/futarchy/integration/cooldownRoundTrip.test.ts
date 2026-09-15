import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// The anti-grief mechanism spans finalize (stamp) and launch (check) across
// two proposals. The takeover cooldown round-trip is unit-covered in
// launchProposal.test.ts; this drives the liquidation kind's stamp and its
// 10-day cooldown through the same seam.
export default function suite() {
  it("refuses a relaunch inside the liquidation cooldown and launches once it elapses", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      1_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: null,
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Fail a first liquidation so the DAO stamps last_failed_liquidation_at
    const first = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: Keypair.generate().publicKey,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: first.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: first.squadsProposal,
      })
      .rpc();

    // One swap after the TWAP start delay records an observation in both
    // markets; the equal TWAPs it leaves can't clear the +25% threshold
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 10);
    await this.futarchy.finalizeProposal(first.proposal);

    const failedProposal = await this.futarchy.getProposal(first.proposal);
    assert.exists(failedProposal.state.failed);

    const clock = await this.banksClient.getClock();
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(
      storedDao.lastFailedLiquidationAt.toString(),
      clock.unixTimestamp.toString(),
    );
    // Only a PASSED liquidation reserves the DAO at finalize
    assert.isNull(storedDao.liquidator);

    // An immediate relaunch is refused
    const second = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: Keypair.generate().publicKey,
    });

    const callbacks = expectError(
      "ProposalKindCooldownActive",
      "launched a hostile liquidation during its cooldown",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // The 10-day cooldown gate is inclusive of its final second
    await this.advanceBySeconds(60 * 60 * 24 * 10);

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(second.proposal);
    assert.exists(storedProposal.state.pending);
  });
}
