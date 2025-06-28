import {
  getDaoAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.5";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, ONE_MINUTE_IN_SLOTS } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 1_000_000
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.autocratClient
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          slotsPerProposal: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24 * 3),
          twapStartDelaySlots: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24),
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1000),
          passThresholdBps: 300,
          nonce,
        },
      })
      .rpc();

    [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    const descriptionUrl = "https://example.com/proposal";
    const baseTokensToLP = new BN(10 * 10 ** 9); // 10 META
    const quoteTokensToLP = new BN(5000 * 10 ** 6); // 5000 USDC

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.autocratClient
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          slotsPerProposal: null,
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
    proposal = await this.autocratClient.initializeProposal(
      dao,
      descriptionUrl,
      squadsProposalPda,
      baseTokensToLP,
      quoteTokensToLP
    );
  });

  it("doesn't finalize proposals that are too young", async function () {
    let callbacks = expectError(
      "ProposalTooYoung",
      "proposal is too young to finalize"
    );

    await this.autocratClient
      .finalizeProposal(proposal)
      .then(callbacks[0], callbacks[1]);
  });

  it("passes proposals when Pass TWAP > Fail TWAP", async function () {
    // Split tokens into the vaults
    const { baseVault, quoteVault, question } =
      this.autocratClient.getProposalPdas(proposal, META, USDC, dao);

    await this.vaultClient
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.vaultClient
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    const { passAmm, passBaseMint, passQuoteMint, failAmm } =
      this.autocratClient.getProposalPdas(proposal, META, USDC, dao);
    await this.ammClient
      .swapIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        { buy: {} },
        new BN(10000).muln(1_000_000),
        new BN(0)
      )
      .rpc();

    for (let i = 0; i < 100; i++) {
      await this.advanceBySlots(20_000n);

      await this.ammClient
        .crankThatTwapIx(passAmm)
        .preInstructions([
          // this is to get around bankrun thinking we've processed the same transaction multiple times
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: i,
          }),
          await this.ammClient.crankThatTwapIx(failAmm).instruction(),
        ])
        .rpc();
    }

    // Finalize the proposal
    await this.autocratClient.finalizeProposal(proposal);

    const storedProposal = await this.autocratClient.getProposal(proposal);
    assert.exists(storedProposal.state.passed);
  });

  it("fails proposals when Pass TWAP < Fail TWAP", async function () {
    // Split tokens into the vaults
    const { passAmm, failAmm } = this.autocratClient.getProposalPdas(
      proposal,
      META,
      USDC,
      dao
    );

    for (let i = 0; i < 100; i++) {
      await this.advanceBySlots(20_000n);

      await this.ammClient
        .crankThatTwapIx(passAmm)
        .preInstructions([
          // this is to get around bankrun thinking we've processed the same transaction multiple times
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: i,
          }),
          await this.ammClient.crankThatTwapIx(failAmm).instruction(),
        ])
        .rpc();
    }

    // Finalize the proposal
    await this.autocratClient.finalizeProposal(proposal);

    const storedProposal = await this.autocratClient.getProposal(proposal);
    assert.exists(storedProposal.state.failed);
  });
}
