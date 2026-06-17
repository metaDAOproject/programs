import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { setupBasicDao, expectError } from "../../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

// Rewrites a real Proposal account to the pre-migration (pre-`is_metadao_approved`)
// on-chain layout by dropping its final byte. Proposal is fixed-size, so the last
// byte is exactly `is_metadao_approved` — truncation yields a faithful old account.
async function truncateToOldLayout(
  ctx: TestContext,
  proposal: PublicKey,
  opts: { lamports?: number } = {},
) {
  const raw = await ctx.banksClient.getAccount(proposal);
  ctx.context.setAccount(proposal, {
    ...raw,
    data: raw.data.slice(0, raw.data.length - 1),
    ...(opts.lamports !== undefined ? { lamports: opts.lamports } : {}),
  });
}

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    squadsProposalPda: PublicKey;

  // The new Proposal layout is exactly 1 byte longer than the old one (the
  // appended `is_metadao_approved` bool). AFTER_SIZE is the migrated length;
  // BEFORE_SIZE the pre-migration length.
  let AFTER_SIZE: number, BEFORE_SIZE: number;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Wrap an arbitrary instruction in a squads vault transaction so we have a
    // valid active squads proposal to initialize the futarchy proposal against.
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          baseToStake: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          twapStartDelaySeconds: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    proposal = await this.futarchy.initializeProposal(dao, squadsProposalPda);

    const raw = await this.banksClient.getAccount(proposal);
    AFTER_SIZE = raw.data.length;
    BEFORE_SIZE = AFTER_SIZE - 1;
  });

  it("freezes an old-layout proposal on-chain, then the crank migrates and un-freezes it", async function () {
    const original = await this.futarchy.getProposal(proposal);

    await truncateToOldLayout(this, proposal);

    // The fixture is genuinely one byte short of the new layout.
    const short = await this.banksClient.getAccount(proposal);
    assert.equal(short.data.length, BEFORE_SIZE);

    // Frozen on-chain: any instruction taking Account<'info, Proposal> can no
    // longer load the short account, so the proposal is inert until cranked.
    // approve_proposal is representative — it fails to deserialize before validate.
    const frozenCallbacks = expectError(
      "AccountDidNotDeserialize",
      "a frozen proposal must not deserialize on-chain",
    );
    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc()
      .then(frozenCallbacks[0], frozenCallbacks[1]);

    // Crank to the new layout via the raw program object (no SDK wrapper).
    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, payer: this.payer.publicKey })
      .rpc();

    // Grew by exactly the one appended byte.
    const resized = await this.banksClient.getAccount(proposal);
    assert.equal(resized.data.length, AFTER_SIZE);

    const migrated = await this.futarchy.getProposal(proposal);
    assert.isFalse(migrated.isMetadaoApproved);

    // Every carried-over field is identical to the pre-truncation account.
    assert.deepEqual(
      JSON.parse(JSON.stringify(migrated)),
      JSON.parse(JSON.stringify(original)),
    );

    // Un-frozen: the same instruction that failed pre-crank now succeeds,
    // proving the crank makes the proposal interactable again. (Incrementing the
    // compute-unit limit keeps this transaction's signature distinct from the
    // pre-crank attempt above.)
    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const approved = await this.futarchy.getProposal(proposal);
    assert.isTrue(approved.isMetadaoApproved);
  });

  it("is a no-op on an already-new-layout proposal", async function () {
    const before = await this.futarchy.getProposal(proposal);

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, payer: this.payer.publicKey })
      .rpc();

    const raw = await this.banksClient.getAccount(proposal);
    assert.equal(raw.data.length, AFTER_SIZE);

    const after = await this.futarchy.getProposal(proposal);
    assert.deepEqual(
      JSON.parse(JSON.stringify(after)),
      JSON.parse(JSON.stringify(before)),
    );
  });

  it("is idempotent across repeated resizes", async function () {
    await truncateToOldLayout(this, proposal);

    // First crank migrates the account...
    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, payer: this.payer.publicKey })
      .rpc();

    // ...the second is a no-op (compute-budget bump for a unique signature).
    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, payer: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const resized = await this.banksClient.getAccount(proposal);
    assert.equal(resized.data.length, AFTER_SIZE);
    const migrated = await this.futarchy.getProposal(proposal);
    assert.isFalse(migrated.isMetadaoApproved);
  });

  it("tops up rent from the payer when the account is under-funded", async function () {
    const rent = await this.banksClient.getRent();
    const rentBefore = rent.minimumBalance(BigInt(BEFORE_SIZE));
    const rentAfter = rent.minimumBalance(BigInt(AFTER_SIZE));
    const delta = rentAfter - rentBefore;

    // Truncate AND drop lamports to the old rent-exempt minimum so the realloc
    // forces a top-up transfer.
    await truncateToOldLayout(this, proposal, { lamports: Number(rentBefore) });

    // Fund a dedicated crank payer (not the fee payer) so its balance change
    // isolates the top-up transfer from transaction fees.
    const crankPayer = Keypair.generate();
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: crankPayer.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    const payerBefore = await this.banksClient.getBalance(crankPayer.publicKey);

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, payer: crankPayer.publicKey })
      .signers([crankPayer])
      .rpc();

    const payerAfter = await this.banksClient.getBalance(crankPayer.publicKey);
    const proposalLamports = await this.banksClient.getBalance(proposal);

    // Account brought exactly to the new rent-exempt minimum, funded by the payer.
    assert.equal(proposalLamports.toString(), rentAfter.toString());
    assert.equal((payerBefore - payerAfter).toString(), delta.toString());
  });

  it("fails when given an account that is not a Proposal", async function () {
    // The dao is owned by futarchy but carries the Dao discriminator, so the
    // crank's discriminator guard rejects it.
    let threw = false;
    try {
      await this.futarchy.futarchy.methods
        .resizeProposal()
        .accounts({ proposal: dao, payer: this.payer.publicKey })
        .rpc();
    } catch {
      threw = true;
    }
    assert.isTrue(threw);
  });
}
