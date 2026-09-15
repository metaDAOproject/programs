import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  executeVaultTransaction,
  expectError,
  passProposal,
} from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// A payload the team had approved before a liquidation stays executable
// afterwards; the cancellation set is how the liquidator kills it.
export default function suite() {
  it("lets the liquidator cancel a large spend approved before the liquidation", async function () {
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
      500_000 * 1_000_000,
    );

    const team = Keypair.generate();
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          // 10% per update: TWAPs converge to actual prices fast enough that
          // a pumped pass market clears HostileLiquidate's +25%
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(10),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: team.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });
    const vault = (await this.futarchy.getDao(dao)).squadsMultisigVault;

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

    // The team's large spend passes, and nobody executes it
    const amount = new BN(3_000_000_000); // 3,000 USDC
    await this.createTokenAccount(USDC, team.publicKey);

    const {
      proposal: spendProposal,
      squadsProposal: spendSquadsProposal,
      squadsTransaction: spendSquadsTransaction,
    } = await this.futarchy.initializeLargeSpendProposal({ dao, amount });

    await this.futarchy
      .sponsorProposalIx({
        proposal: spendProposal,
        dao,
        teamAddress: team.publicKey,
      })
      .signers([team])
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal: spendProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: spendSquadsProposal,
      })
      .rpc();

    // Uncontested: one swap after the kind's 12-hour TWAP delay leaves the
    // TWAPs equal, which clears the sponsored -10% threshold
    await this.advanceBySeconds(60 * 60 * 12 + 60);
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();
    await this.advanceBySeconds(129_600);
    await this.futarchy.finalizeProposal(spendProposal);

    let storedSpend = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      spendSquadsProposal,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(storedSpend.status),
    );

    // Fund the treasury ATA the payload pulls from, so only the cancellation
    // stands between the old team and the money
    await this.createTokenAccount(USDC, vault);
    await this.mintTo(USDC, vault, this.payer, amount.toNumber());

    // A hostile liquidation passes
    const liquidator = Keypair.generate();
    const {
      proposal: liquidateProposal,
      squadsProposal: liquidateSquadsProposal,
    } = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: liquidator.publicKey,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: liquidateProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: liquidateSquadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal: liquidateProposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator.publicKey));

    // The spend is still a standing mandate
    storedSpend = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      spendSquadsProposal,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(storedSpend.status),
    );

    // The liquidator pays rent for the enqueued cancellation account
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: liquidator.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    // The spend was the DAO's first Squads transaction
    const spendTransactionIndex = 1n;

    const callbacks = expectError(
      "InvalidLiquidator",
      "enqueue by a non-liquidator should fail on a liquidated DAO",
    );

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({
        dao,
        transactionIndex: spendTransactionIndex,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // The liquidator enqueues; anyone runs the cancel
    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({
        dao,
        transactionIndex: spendTransactionIndex,
        admin: liquidator.publicKey,
      })
      .signers([liquidator])
      .rpc();

    await this.futarchy
      .executeMultisigProposalCancellationIx({
        dao,
        transactionIndex: spendTransactionIndex,
      })
      .rpc();

    storedSpend = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      spendSquadsProposal,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusCancelled(storedSpend.status),
    );
    assert.deepEqual(
      storedSpend.cancelled.map((k) => k.toBase58()),
      [dao.toBase58()],
    );

    // The payload can no longer move the estate
    try {
      await executeVaultTransaction(this, dao, spendSquadsTransaction);
      assert.fail("Should have thrown error");
    } catch (e) {
      // Squads' InvalidProposalStatus (0x1778 = 6008)
      assert.isTrue(e.toString().includes("0x1778"), `unexpected error: ${e}`);
    }

    assert.equal(
      (await this.getTokenBalance(USDC, vault)).toString(),
      amount.toString(),
    );
    assert.equal(
      (await this.getTokenBalance(USDC, team.publicKey)).toString(),
      "0",
    );
  });
}
