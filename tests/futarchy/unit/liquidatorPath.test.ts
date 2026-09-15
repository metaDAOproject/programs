import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  getDaoAddr,
  getProposalAddrsForTransactionIndex,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import BN from "bn.js";
import {
  executeVaultTransaction,
  expectError,
  passProposal,
  THOUSAND_BUCK_PRICE,
} from "../../utils.js";

const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    vault: PublicKey,
    squadsMultisig: PublicKey,
    liquidator: Keypair;

  // The estate cycle starts from a genuinely liquidated DAO: a hostile
  // liquidation market passes and its payload executes.
  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

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

    const storedDao = await this.futarchy.getDao(dao);
    vault = storedDao.squadsMultisigVault;
    squadsMultisig = storedDao.squadsMultisig;

    // The baked apply_liquidation payload requires the vault's ATAs to exist
    await this.createTokenAccount(META, vault);
    await this.createTokenAccount(USDC, vault);

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

    liquidator = Keypair.generate();

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator: liquidator.publicKey,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    await executeVaultTransaction(this, dao, squadsTransaction);

    // The liquidator pays rent for the enqueued approval account
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

    // The estate: give the vault something to distribute
    await this.mintTo(USDC, vault, this.payer, 1_000 * 1_000_000);
  });

  // A Squads vault transaction + proposal carrying one estate instruction:
  // pay out USDC from the vault
  const createEstateProposal = async function (
    context: any,
    transactionIndex: bigint,
    instructions: any[],
  ) {
    const { tx } = context.futarchy.squadsProposalCreateTx({
      dao,
      instructions,
      transactionIndex,
    });
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
    await context.banksClient.processTransaction(tx);

    return getProposalAddrsForTransactionIndex({ dao, transactionIndex });
  };

  const deriveEnqueuedApprovalPda = (
    context: any,
    transactionIndex: bigint,
  ): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        SEED_ENQUEUED_APPROVAL,
        dao.toBuffer(),
        new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
      ],
      context.futarchy.futarchy.programId,
    );
    return pda;
  };

  it("refuses a non-liquidator enqueue once the DAO is liquidated", async function () {
    const recipient = Keypair.generate().publicKey;
    const recipientAta = await this.createTokenAccount(USDC, recipient);
    const vaultUsdcAta = getAssociatedTokenAddressSync(USDC, vault, true);

    // The liquidation payload was transaction 1; the estate starts at 2
    const { squadsProposal } = await createEstateProposal(this, 2n, [
      createTransferInstruction(
        vaultUsdcAta,
        recipientAta,
        vault,
        600 * 1_000_000,
      ),
    ]);

    const callbacks = expectError(
      "InvalidLiquidator",
      "enqueue by a non-liquidator should fail on a liquidated DAO",
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(2) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedApproval: deriveEnqueuedApprovalPda(this, 2n),
      })
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("runs the estate cycle: liquidator enqueues, the DAO PDA approves permissionlessly, ordinary Squads execution pays out", async function () {
    const recipient = Keypair.generate().publicKey;
    const recipientAta = await this.createTokenAccount(USDC, recipient);
    const vaultUsdcAta = getAssociatedTokenAddressSync(USDC, vault, true);

    const { squadsProposal, squadsTransaction } = await createEstateProposal(
      this,
      2n,
      [
        createTransferInstruction(
          vaultUsdcAta,
          recipientAta,
          vault,
          600 * 1_000_000,
        ),
      ],
    );

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, 2n);

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(2) })
      .accounts({
        dao,
        admin: liquidator.publicKey,
        squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([liquidator])
      .rpc();

    const enqueued =
      await this.futarchy.futarchy.account.enqueuedMultisigProposalApproval.fetch(
        enqueuedApprovalPda,
      );
    assert.equal(enqueued.dao.toBase58(), dao.toBase58());
    assert.equal(enqueued.transactionIndex.toString(), "2");

    // The middle leg stays permissionless: any signer cranks the DAO PDA's
    // approve vote, which meets the threshold of 1 on its own
    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: this.payer.publicKey,
        squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedApproval: enqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc();

    let storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(storedSquadsProposal.status),
    );
    assert.deepEqual(
      storedSquadsProposal.approved.map((k) => k.toBase58()),
      [dao.toBase58()],
    );

    // Execution is the ordinary top-level Squads execute — no futarchy
    // instruction and no liquidator signature involved
    await executeVaultTransaction(this, dao, squadsTransaction);

    storedSquadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsProposal,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusExecuted(storedSquadsProposal.status),
    );

    assert.equal(
      (await this.getTokenBalance(USDC, recipient)).toString(),
      "600000000",
    );
    assert.equal(
      (await this.getTokenBalance(USDC, vault)).toString(),
      "400000000",
    );
  });
}
