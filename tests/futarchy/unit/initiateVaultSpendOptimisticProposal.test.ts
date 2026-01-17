import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.7";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { getDaoAddr, MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";
import { assert } from "chai";
import * as squads from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, dao: PublicKey, spendingLimit: BN;
  let setOptimisticGovernanceEnabled: (
    dao: PublicKey,
    enabled: boolean,
  ) => Promise<void>;

  beforeEach(async function () {
    setOptimisticGovernanceEnabled = async (
      dao: PublicKey,
      enabled: boolean,
    ) => {
      const daoAccount = await this.futarchy.getDao(dao);
      daoAccount.isOptimisticGovernanceEnabled = enabled;
      const daoAccountBuffer =
        await this.futarchy.autocrat.account.dao.coder.accounts.encode(
          "dao",
          daoAccount,
        );

      const daoBanksAccount = await this.banksClient.getAccount(dao);
      daoBanksAccount.data.set(daoAccountBuffer, 0);
      this.context.setAccount(dao, daoBanksAccount);
    };
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

    await setOptimisticGovernanceEnabled(dao, true);
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

    const { question, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      META,
      MAINNET_USDC,
      dao,
    );

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

    await this.futarchy.autocrat.methods
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
    await setOptimisticGovernanceEnabled(dao, false);

    const callbacks = expectError(
      "OptimisticGovernanceDisabled",
      "DAO doesn't have optimistic governance enabled",
    );

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 0n,
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
      await this.futarchy.autocrat.account.dao.coder.accounts.encode(
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
        transactionIndex: 1n,
      })
      .preInstructions([
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
      .preInstructions([
        // Add any instruction to prevent banksClient from reverting the transaction - compute budget is perfectly fine
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
