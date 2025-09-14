import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.6";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  expectError,
  setupBasicDao,
} from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
const { Permissions, Permission } = multisig.types;

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey, multisigPda: PublicKey, squadsProposal: PublicKey;

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
      200_000 * 1_000_000
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
        quoteAmount: new BN(100_000 * 10 ** 6), // 100,000 USDC
        maxBaseAmount: new BN(100 * 10 ** 6), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const newSpendingLimitPda = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    const addSpendingLimitIx = multisig.instructions.multisigAddSpendingLimit({
      multisigPda,
      spendingLimit: newSpendingLimitPda,
      configAuthority: dao,
      rentPayer: this.payer.publicKey,
      createKey: dao,
      vaultIndex: 0,
      mint: USDC,
      amount: new BN(50_000 * 10 ** 6), // 50,000 USDC
      period: multisig.types.Period.Month,
      members: [this.payer.publicKey], // Only the DAO can use this spending limit
      destinations: [], // No specific destinations
      memo: "",
    });

    const removeMemberIx = multisig.instructions.multisigRemoveMember({
      multisigPda,
      configAuthority: dao,
      oldMember: dao,
    });

    const proposalResult = await this.initializeAndLaunchProposal({
        dao,
        instructions: [{
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("Hello, world!"),
        }]
    });

    proposal = proposalResult.proposal;
    squadsProposal = proposalResult.squadsProposal;
  });

  it.only("executes spending limit change proposal", async function () {
    const { question, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );


    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Trade heavily on pass market to make it pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
      })
      .rpc();

    // Crank TWAP to build up price history
    for (let i = 0; i < 100; i++) {
        this.advanceBySeconds(10_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Finalize the proposal
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    const [vaultTransactionPda] = multisig.getTransactionPda({
        multisigPda: multisigPda,
        index: 1n,
    });

    const transactionAccount = await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda
    );

    const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: transactionAccount.vaultIndex,
        programId: multisig.PROGRAM_ID,
    });

    const { accountMetas, lookupTableAccounts } =
        await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
        });

    // await multisig.instructions.vaultTransactionExecute()

    console.log(dao.toString());

    await this.futarchy.autocrat.methods.executeSpendingLimitChange().accounts({
        squadsMultisig: multisigPda,
        proposal,
        dao,
        squadsProposal,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
        // eventAuthority: this.payer.publicKey,
        // program: this.futarchy.getProgramId(),
    }).remainingAccounts(accountMetas.map(meta => meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta)).rpc();

    return;

    // multisig.instructions.vaultTransactionExecute



    // Get the vault transaction account
    const vaultTransaction = await multisig.accounts.vaultTransaction.fetch(vaultTransactionPda);

    // Call executeSpendingLimitChange directly through the program
    const executeSpendingLimitChangeIx = await this.futarchy.program.methods
      .executeSpendingLimitChange()
      .accounts({
        proposal,
        dao,
        squadsProposal: squadsProposalPda,
        squadsMultisig: multisigPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .instruction();

    await this.banksClient.processTransaction(
      new Transaction().add(executeSpendingLimitChangeIx),
      [this.payer]
    );

    // Verify the spending limit was updated
    const updatedSpendingLimits = await multisig.accounts.spendingLimit.all([
      {
        memcmp: {
          offset: 8, // discriminator
          bytes: multisigPda.toBase58(),
        },
      },
    ]);

    // Should have the new spending limit
    assert.equal(updatedSpendingLimits.length, 1);
    const newSpendingLimit = updatedSpendingLimits[0].account;
    assert.equal(newSpendingLimit.amount.toString(), new BN(50_000 * 10 ** 6).toString());
    assert.equal(newSpendingLimit.mint.toBase58(), USDC.toBase58());
  });

  it("fails to execute spending limit change for non-passed proposal", async function () {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    
    // Create a simple instruction for the proposal
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
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

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

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Create the squads proposal first
    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    // Now initialize the autocrat proposal
    proposal = await this.futarchy.initializeProposal(dao, squadsProposalPda);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc();

    // Don't make the proposal pass - leave it in draft state
    const [vaultTransactionPda] = multisig.getVaultTransactionPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Try to execute spending limit change on non-passed proposal
    const callbacks = expectError(
      "ProposalNotPassed",
      "This proposal can't be executed because it isn't in the passed state"
    );

    const executeSpendingLimitChangeIx = await this.futarchy.program.methods
      .executeSpendingLimitChange()
      .accounts({
        proposal,
        dao,
        squadsProposal: squadsProposalPda,
        squadsMultisig: multisigPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .instruction();

    await this.banksClient
      .processTransaction(new Transaction().add(executeSpendingLimitChangeIx), [this.payer])
      .then(callbacks[0], callbacks[1]);
  });
}
