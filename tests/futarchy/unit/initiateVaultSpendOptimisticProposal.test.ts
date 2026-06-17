import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  SQUADS_PROGRAM_ID,
  getDaoAddr,
  MAINNET_USDC,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, setOptimisticGovernanceEnabled } from "../../utils.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import * as squads from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, dao: PublicKey, spendingLimit: BN;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    spendingLimit = new BN(10_000);
    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);

    // Mint tokens to payer's accounts
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: MAINNET_USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: spendingLimit,
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          baseToSupermajority: new BN(0),
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

    const daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(MAINNET_USDC, daoAccount.squadsMultisigVault);

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      daoAccount.squadsMultisigVault,
      100_000 * 1_000_000,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        quoteAmount: new BN(100_000 * 10 ** 6),
      })
      .rpc();

    await setOptimisticGovernanceEnabled(this, dao, true);
  });

  it("can initiate a vault spend optimistic proposal", async function () {
    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    const daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const clock = await this.banksClient.getClock();
    assert.equal(
      daoAccount.optimisticProposal.enqueuedTimestamp.toString(),
      clock.unixTimestamp.toString(),
    );

    const [expectedSquadsProposal] = squads.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });
    assert.equal(
      expectedSquadsProposal.toBase58(),
      daoAccount.optimisticProposal.squadsProposal.toBase58(),
    );
  });

  it("can still initiate a vault spend optimistic proposal after a DAO changes their spending limit", async function () {
    const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
    const daoSpendingLimitPda = squads.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    const removeSpendingLimitIx =
      squads.instructions.multisigRemoveSpendingLimit({
        multisigPda,
        configAuthority: dao,
        spendingLimit: daoSpendingLimitPda,
        rentCollector: this.payer.publicKey,
        memo: "",
      });

    const addSpendingLimitIx = squads.instructions.multisigAddSpendingLimit({
      multisigPda,
      spendingLimit: daoSpendingLimitPda,
      configAuthority: dao,
      rentPayer: this.payer.publicKey,
      createKey: dao,
      vaultIndex: 0,
      mint: MAINNET_USDC,
      amount: BigInt(spendingLimit.muln(3).toString()), // 30,000 USDC
      period: squads.types.Period.Month,
      members: [this.payer.publicKey], // Only the DAO can use this spending limit
      destinations: [], // No specific destinations
      memo: "",
    });

    const { proposal, squadsProposal } = await this.initializeAndLaunchProposal(
      {
        dao,
        instructions: [removeSpendingLimitIx, addSpendingLimitIx],
      },
    );

    const { question, quoteVault, passBaseMint } =
      this.futarchy.getProposalPdas(proposal, META, MAINNET_USDC, dao);

    await this.conditionalVault
      .splitTokensIx(
        question,
        quoteVault,
        MAINNET_USDC,
        new BN(11_000 * 1_000_000),
        2,
      )
      .rpc();

    // Trade heavily on pass market to make it pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.payer.publicKey,
          getAssociatedTokenAddressSync(
            passBaseMint,
            this.payer.publicKey,
            true,
          ),
          this.payer.publicKey,
          passBaseMint,
        ),
      ])
      .rpc();

    // Crank TWAP to build up price history
    for (let i = 0; i < 100; i++) {
      this.advanceBySeconds(10_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
          createAssociatedTokenAccountIdempotentInstruction(
            this.payer.publicKey,
            getAssociatedTokenAddressSync(
              passBaseMint,
              this.payer.publicKey,
              true,
            ),
            this.payer.publicKey,
            passBaseMint,
          ),
        ])
        .rpc();
    }

    // Finalize the proposal
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    const [vaultTransactionPda] = squads.getTransactionPda({
      multisigPda: multisigPda,
      index: 1n,
    });

    const transactionAccount =
      await squads.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const [vaultPda] = squads.getVaultPda({
      multisigPda,
      index: transactionAccount.vaultIndex,
      programId: squads.PROGRAM_ID,
    });

    const { accountMetas } = await squads.utils.accountsForTransactionExecute({
      connection: this.squadsConnection,
      message: transactionAccount.message,
      ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
      vaultPda,
      transactionPda: vaultTransactionPda,
      programId: squads.PROGRAM_ID,
    });

    await this.futarchy.futarchy.methods
      .executeSpendingLimitChange()
      .accounts({
        squadsMultisig: multisigPda,
        proposal,
        dao,
        squadsProposal,
        squadsMultisigProgram: squads.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .rpc();

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 2n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    const daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const clock = await this.banksClient.getClock();
    assert.equal(
      daoAccount.optimisticProposal.enqueuedTimestamp.toString(),
      clock.unixTimestamp.toString(),
    );

    const [expectedSquadsProposal] = squads.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 2n,
    });
    assert.equal(
      expectedSquadsProposal.toBase58(),
      daoAccount.optimisticProposal.squadsProposal.toBase58(),
    );
  });

  it("can't initiate a vault spend optimistic proposal if the DAO doesn't have optimistic governance enabled", async function () {
    await setOptimisticGovernanceEnabled(this, dao, false);

    const callbacks = expectError(
      "OptimisticGovernanceDisabled",
      "DAO doesn't have optimistic governance enabled",
    );

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't initiate a vault spend optimistic proposal if the DAO is not in spot state", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const dummyMarket = {
      baseProtocolFeeBalance: new BN(0),
      quoteProtocolFeeBalance: new BN(0),
      baseReserves: new BN(0),
      quoteReserves: new BN(0),
      oracle: {
        aggregator: new BN(0),
        lastUpdatedTimestamp: new BN(0),
        createdAtTimestamp: new BN(0),
        lastPrice: new BN(0),
        lastObservation: new BN(0),
        maxObservationChangePerUpdate: new BN(0),
        initialObservation: new BN(0),
        startDelaySeconds: 0,
      },
    };

    daoAccount.amm.state = {
      futarchy: {
        spot: dummyMarket,
        pass: dummyMarket,
        fail: dummyMarket,
      },
    };

    const daoAccountBuffer =
      await this.futarchy.futarchy.account.dao.coder.accounts.encode(
        "dao",
        daoAccount,
      );
    const daoBanksAccount = await this.banksClient.getAccount(dao);
    daoBanksAccount.data.set(daoAccountBuffer, 0);
    this.context.setAccount(dao, daoBanksAccount);

    const callbacks = expectError(
      "PoolNotInSpotState",
      "Pool is not in spot state",
    );

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't initialize a vault spend optimistic proposal if the DAO has an active optimistic proposal", async function () {
    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    const callbacks = expectError(
      "ActiveOptimisticProposalAlreadyEnqueued",
      "An active optimistic proposal is already enqueued",
    );

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 2n,
      })
      .postInstructions([
        // Add any instruction to prevent banksClient from reverting the transaction - compute budget is perfectly fine
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can initialize a vault spend optimistic proposal if the amount is less than or equal to 3 times the spending limit", async function () {
    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: spendingLimit.muln(3),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();
  });

  it("can't initialize a vault spend optimistic proposal if the amount is greater than 3 times the spending limit", async function () {
    const callbacks = expectError(
      "InvalidAmount",
      "Amount is greater than 3 times the spending limit",
    );

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: spendingLimit.muln(3).addn(1),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .postInstructions([
        // Add any instruction to prevent banksClient from reverting the transaction - compute budget is perfectly fine
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  describe("vault transaction validation", function () {
    async function createSquadsVtAndProposal(
      ctx: any,
      multisigPda: PublicKey,
      instructions: TransactionInstruction[],
      transactionIndex: bigint,
      isDraft: boolean = false,
    ) {
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];
      const transactionMessage = new TransactionMessage({
        payerKey: vault,
        recentBlockhash: (await ctx.banksClient.getLatestBlockhash())[0],
        instructions,
      });

      const tx = new Transaction().add(
        squads.instructions.vaultTransactionCreate({
          multisigPda,
          transactionIndex,
          creator: PERMISSIONLESS_ACCOUNT.publicKey,
          rentPayer: ctx.payer.publicKey,
          vaultIndex: 0,
          ephemeralSigners: 0,
          transactionMessage,
        }),
        squads.instructions.proposalCreate({
          multisigPda,
          transactionIndex,
          creator: PERMISSIONLESS_ACCOUNT.publicKey,
          rentPayer: ctx.payer.publicKey,
          isDraft,
        }),
      );

      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = ctx.payer.publicKey;
      tx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);

      await ctx.banksClient.processTransaction(tx);

      const [squadsProposal] = squads.getProposalPda({
        multisigPda,
        transactionIndex,
      });
      const [squadsVaultTransaction] = squads.getTransactionPda({
        multisigPda,
        index: transactionIndex,
      });

      return { squadsProposal, squadsVaultTransaction };
    }

    async function callInitiateRaw(
      ctx: any,
      dao: PublicKey,
      amount: BN,
      recipient: PublicKey,
      squadsProposal: PublicKey,
      squadsVaultTransaction: PublicKey,
    ) {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const squadsMultisigVault = squads.getVaultPda({
        multisigPda,
        index: 0,
      })[0];
      const squadsSpendingLimit = squads.getSpendingLimitPda({
        multisigPda,
        createKey: dao,
      })[0];
      const daoAccount = await ctx.futarchy.getDao(dao);
      const daoQuoteVaultAccount = getAssociatedTokenAddressSync(
        daoAccount.quoteMint,
        squadsMultisigVault,
        true,
      );
      const recipientQuoteAccount = getAssociatedTokenAddressSync(
        daoAccount.quoteMint,
        recipient,
        true,
      );

      return ctx.futarchy.futarchy.methods
        .initiateVaultSpendOptimisticProposal({ amount })
        .accounts({
          squadsMultisig: multisigPda,
          squadsMultisigVault,
          squadsSpendingLimit,
          squadsProposal,
          squadsVaultTransaction,
          dao,
          daoQuoteVaultAccount,
          proposer: ctx.payer.publicKey,
          recipient,
          recipientQuoteAccount,
          squadsProgram: SQUADS_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            ctx.payer.publicKey,
            recipientQuoteAccount,
            recipient,
            daoAccount.quoteMint,
          ),
        ]);
    }

    it("fails when vault transaction has wrong transfer amount", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const wrongAmountIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        500n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [wrongAmountIx], 1n);

      const callbacks = expectError(
        "InvalidTransaction",
        "VT amount doesn't match instruction amount",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction has wrong recipient", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];
      const wrongRecipient = Keypair.generate().publicKey;

      // Create the wrong-recipient's ATA so the instruction references it
      const wrongRecipientAta = getAssociatedTokenAddressSync(
        MAINNET_USDC,
        wrongRecipient,
      );

      const wrongDestIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        wrongRecipientAta,
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [wrongDestIx], 1n);

      const callbacks = expectError(
        "InvalidTransaction",
        "VT destination doesn't match recipient",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction has wrong source", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];
      const wrongSource = Keypair.generate().publicKey;
      const wrongSourceAta = getAssociatedTokenAddressSync(
        MAINNET_USDC,
        wrongSource,
      );

      const wrongSrcIx = createTransferInstruction(
        wrongSourceAta,
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [wrongSrcIx], 1n);

      const callbacks = expectError(
        "InvalidTransaction",
        "VT source doesn't match dao vault account",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction uses wrong program", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      // Build a raw instruction targeting SystemProgram with SPL Transfer-like data
      const data = Buffer.alloc(9);
      data[0] = 3; // SPL Transfer discriminator
      data.writeBigUInt64LE(1000n, 1);

      const wrongProgramIx = new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          {
            pubkey: getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: getAssociatedTokenAddressSync(
              MAINNET_USDC,
              this.payer.publicKey,
            ),
            isSigner: false,
            isWritable: true,
          },
          { pubkey: vault, isSigner: true, isWritable: false },
        ],
        data,
      });

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(
          this,
          multisigPda,
          [wrongProgramIx],
          1n,
        );

      const callbacks = expectError(
        "InvalidTransaction",
        "VT instruction targets wrong program",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction has multiple instructions", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      // Two identical transfer instructions
      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(
          this,
          multisigPda,
          [transferIx, transferIx],
          1n,
        );

      const callbacks = expectError(
        "InvalidTransaction",
        "VT has multiple instructions",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when squads proposal is in Draft status", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(
          this,
          multisigPda,
          [transferIx],
          1n,
          true, // isDraft = true
        );

      const callbacks = expectError(
        "InvalidSquadsProposalStatus",
        "Squads proposal is in Draft status",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction has wrong vault_index", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        vaultIndex: 1,
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "VT has wrong vault_index",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when vault transaction has ephemeral signers", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        ephemeralSignerBumps: Uint8Array.from([255]),
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "VT has ephemeral signers",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when message has wrong num_signers", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        message: {
          ...vtAccount.message,
          numSigners: 2,
        },
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Message has wrong num_signers",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when first signer is not the vault", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const tamperedKeys = [...vtAccount.message.accountKeys];
      tamperedKeys[0] = Keypair.generate().publicKey;

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        message: {
          ...vtAccount.message,
          accountKeys: tamperedKeys,
        },
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "First signer is not the vault",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when message has wrong num_writable_signers", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        message: {
          ...vtAccount.message,
          numWritableSigners: 2,
        },
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Message has too many writable signers",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when message has wrong num_writable_non_signers", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        message: {
          ...vtAccount.message,
          numWritableNonSigners: 1,
        },
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Message has wrong numWritableNonSigners",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when message has address table lookups", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const vtAccount =
        await squads.accounts.VaultTransaction.fromAccountAddress(
          this.squadsConnection,
          squadsVaultTransaction,
        );

      const modifiedVt = squads.accounts.VaultTransaction.fromArgs({
        ...vtAccount,
        message: {
          ...vtAccount.message,
          addressTableLookups: [
            {
              accountKey: Keypair.generate().publicKey,
              writableIndexes: Uint8Array.from([0]),
              readonlyIndexes: Uint8Array.from([1]),
            },
          ],
        },
      });
      const [serialized] = modifiedVt.serialize();

      const vtBanksAccount = await this.banksClient.getAccount(
        squadsVaultTransaction,
      );
      vtBanksAccount.data = serialized;
      this.context.setAccount(squadsVaultTransaction, vtBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Message has address table lookups",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when squads proposal has approvals", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const proposalAccount = await squads.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );

      const modifiedProposal = squads.accounts.Proposal.fromArgs({
        ...proposalAccount,
        approved: [Keypair.generate().publicKey],
      });
      const [serialized] = modifiedProposal.serialize();

      const proposalBanksAccount =
        await this.banksClient.getAccount(squadsProposal);
      proposalBanksAccount.data = serialized;
      this.context.setAccount(squadsProposal, proposalBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Proposal has approvals",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when squads proposal has rejections", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      const proposalAccount = await squads.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );

      const modifiedProposal = squads.accounts.Proposal.fromArgs({
        ...proposalAccount,
        rejected: [Keypair.generate().publicKey],
      });
      const [serialized] = modifiedProposal.serialize();

      const proposalBanksAccount =
        await this.banksClient.getAccount(squadsProposal);
      proposalBanksAccount.data = serialized;
      this.context.setAccount(squadsProposal, proposalBanksAccount);

      const callbacks = expectError(
        "InvalidTransaction",
        "Proposal has rejections",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });

    it("fails when squads proposal is stale", async function () {
      const multisigPda = squads.getMultisigPda({ createKey: dao })[0];
      const vault = squads.getVaultPda({ multisigPda, index: 0 })[0];

      const transferIx = createTransferInstruction(
        getAssociatedTokenAddressSync(MAINNET_USDC, vault, true),
        getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
        vault,
        1000n,
      );

      // Create the squads proposal while stale_transaction_index is 0
      const { squadsProposal, squadsVaultTransaction } =
        await createSquadsVtAndProposal(this, multisigPda, [transferIx], 1n);

      // Now mutate the multisig to set staleTransactionIndex = 1
      const multisigAccount = await squads.accounts.Multisig.fromAccountAddress(
        this.squadsConnection,
        multisigPda,
      );

      const modifiedMultisig = squads.accounts.Multisig.fromArgs({
        ...multisigAccount,
        staleTransactionIndex: new BN(1),
      });
      const [serialized] = modifiedMultisig.serialize();

      const multisigBanksAccount =
        await this.banksClient.getAccount(multisigPda);
      multisigBanksAccount.data.set(serialized, 0);
      this.context.setAccount(multisigPda, multisigBanksAccount);

      const callbacks = expectError(
        "RequireGtViolated",
        "Squads proposal is stale",
      );

      await callInitiateRaw(
        this,
        dao,
        new BN(1000),
        this.payer.publicKey,
        squadsProposal,
        squadsVaultTransaction,
      )
        .then((b: any) => b.signers([this.payer]).rpc())
        .then(callbacks[0], callbacks[1]);
    });
  });
}
