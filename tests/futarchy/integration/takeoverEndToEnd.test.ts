import {
  getDaoAddr,
  getSpendingLimitAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createLookupTableForTransaction, passProposal } from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// Declaration semantics through the whole chain: what the market approved is
// byte-for-byte what lands, on both the DAO record and the Squads projection —
// and the regime change cuts off the old members' pull rights.
export default function suite() {
  it("rotates the regime: create with Set, stake, launch, pass, packed execute + sync", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      2_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      500_000 * 1_000_000,
    );

    const oldMember = Keypair.generate();
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
          initialSpendingLimit: {
            amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
            members: [oldMember.publicKey],
          },
          baseToStake: new BN(1_000 * 1_000_000), // 1,000 META
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

    const storedDaoBefore = await this.futarchy.getDao(dao);
    const vault = storedDaoBefore.squadsMultisigVault;
    const multisigPda = storedDaoBefore.squadsMultisig;

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

    // The old regime works: the old member pulls from the treasury through
    // the Squads spending limit
    await this.createTokenAccount(USDC, vault);
    await this.mintTo(USDC, vault, this.payer, 1_000 * 1_000_000);
    await this.createTokenAccount(USDC, oldMember.publicKey);

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });

    const pullIx = multisig.instructions.spendingLimitUse({
      multisigPda,
      member: oldMember.publicKey,
      spendingLimit: spendingLimitPda,
      mint: USDC,
      vaultIndex: 0,
      amount: 100 * 1_000_000,
      decimals: 6,
      destination: oldMember.publicKey,
    });
    const pullTx = new Transaction().add(pullIx);
    pullTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    pullTx.feePayer = this.payer.publicKey;
    pullTx.sign(this.payer, oldMember);
    await this.banksClient.processTransaction(pullTx);

    assert.equal(
      (await this.getTokenBalance(USDC, oldMember.publicKey)).toString(),
      (100 * 1_000_000).toString(),
    );

    // The declared post-takeover regime: new team, new limit, new members
    const newTeamAddress = Keypair.generate().publicKey;
    const newMember = Keypair.generate();
    const declaredConfig = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [newMember.publicKey],
    };

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { set: { 0: declaredConfig } },
      });

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: new BN(1_000 * 1_000_000),
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    // Runs out the takeover's 20-day snapshot and finalizes to Passed at +10%
    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 90,
    });

    // Packed execute + sync: the declared regime is live on Squads the moment
    // the takeover lands, leaving no window where the outgoing members keep
    // their allowance
    const vaultTransaction =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        squadsTransaction,
      );
    const packIxs = [
      (
        await multisig.instructions.vaultTransactionExecute({
          connection: this.squadsConnection,
          multisigPda,
          transactionIndex: BigInt(vaultTransaction.index.toString()),
          member: PERMISSIONLESS_ACCOUNT.publicKey,
        })
      ).instruction,
      await this.futarchy.syncSpendingLimitIx({ dao }).instruction(),
    ];

    const lut = await createLookupTableForTransaction(
      new Transaction().add(...packIxs),
      this,
    );

    const packMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ...packIxs,
      ],
    }).compileToV0Message([lut]);
    const packTx = new VersionedTransaction(packMessage);
    packTx.sign([this.payer, PERMISSIONLESS_ACCOUNT]);
    await this.banksClient.processTransaction(packTx);

    // The team pointer moved
    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.teamAddress.equals(newTeamAddress));

    // The DAO record matches the declaration, and the sync consumed the flag
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.deepEqual(
      storedDao.initialSpendingLimit.members.map((m) => m.toBase58()),
      declaredConfig.members.map((m) => m.toBase58()),
    );
    assert.isFalse(storedDao.spendingLimitDirty);

    // The Squads projection matches the declaration
    const storedLimit =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        this.squadsConnection,
        spendingLimitPda,
      );
    assert.equal(
      storedLimit.amount.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.equal(
      storedLimit.remainingAmount.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.sameMembers(
      storedLimit.members.map((m) => m.toBase58()),
      declaredConfig.members.map((m) => m.toBase58()),
    );

    // The old member's pull rights are gone — the takeover's economic point
    const oldPullIx = multisig.instructions.spendingLimitUse({
      multisigPda,
      member: oldMember.publicKey,
      spendingLimit: spendingLimitPda,
      mint: USDC,
      vaultIndex: 0,
      amount: 200 * 1_000_000,
      decimals: 6,
      destination: oldMember.publicKey,
    });
    const oldPullTx = new Transaction().add(oldPullIx);
    oldPullTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    oldPullTx.feePayer = this.payer.publicKey;
    oldPullTx.sign(this.payer, oldMember);

    try {
      await this.banksClient.processTransaction(oldPullTx);
      assert.fail("Should have failed with Unauthorized");
    } catch (e) {
      // Squads' Unauthorized (0x1774 = 6004)
      assert(
        e.toString().includes("Unauthorized") ||
          e.toString().includes("0x1774"),
        `Expected Unauthorized error, got: ${e}`,
      );
    }
  });
}
