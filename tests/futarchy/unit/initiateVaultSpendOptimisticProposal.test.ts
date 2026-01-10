import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.7";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { getDaoAddr, MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
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

    console.log("daoAccount", JSON.stringify(daoAccount, null, 2));

    const daoQuoteVaultAddress = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      daoAccount.squadsMultisigVault,
      true,
    );

    await this.createTokenAccount(MAINNET_USDC, daoAccount.squadsMultisigVault);

    // const balance = await this.getTokenBalance(MAINNET_USDC, daoQuoteVaultAddress);
    // console.log("balance", balance.toString());

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      daoAccount.squadsMultisigVault,
      100_000 * 1_000_000,
    );

    await setOptimisticGovernanceEnabled(dao, true);
  });

  it("can initiate a vault spend optimistic proposal if the DAO has optimistic governance enabled", async function () {
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
