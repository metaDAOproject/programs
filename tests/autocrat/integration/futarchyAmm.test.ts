import {
  getDaoAddr,
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
import { expectError, ONE_MINUTE_IN_SLOTS } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 1000_000_000 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      1_000_000_000 * 1_000_000
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.autocratClient
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          slotsPerProposal: new BN((ONE_MINUTE_IN_SLOTS * 60n * 24n * 3n).toString()),
          twapStartDelaySlots: new BN((ONE_MINUTE_IN_SLOTS * 60n * 24n).toString()),
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          baseLiquidityToLp: new BN(100 * 10 ** 6),
          quoteLiquidityToLp: new BN(100 * 10 ** 6),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: null,
          baseToStake: new BN(0),
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
          baseToStake: null,
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

  it.only("futarchy amm", async function () {
    // Get initial state before spot swap (before launching proposal)
    const daoBeforeSpotSwap = await this.autocratClient.autocrat.account.dao.fetch(dao);
    console.log("=== Before spot swap (initial AMM state) ===");
    console.log("Initial base reserves:", daoBeforeSpotSwap.amm.state.spot.spot.baseReserves.toString());
    console.log("Initial quote reserves:", daoBeforeSpotSwap.amm.state.spot.spot.quoteReserves.toString());

    const initialUserBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const initialUserQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
    console.log("Initial user base balance:", initialUserBaseBalance);
    console.log("Initial user quote balance:", initialUserQuoteBalance);

    // Perform a spot swap before launching the proposal
    await this.autocratClient.spotSwapIx({
      dao,
      baseMint: META,
      quoteMint: USDC,
      swapType: "buy",
      inputAmount: new BN(1 * 10 ** 6), // Buy 1 USDC of META
      minOutputAmount: new BN(0)
    }).rpc();

    // Get state after spot swap
    const daoAfterSpotSwap = await this.autocratClient.autocrat.account.dao.fetch(dao);
    console.log("=== After spot swap ===");
    console.log("Final base reserves:", daoAfterSpotSwap.amm.state.spot.spot.baseReserves.toString());
    console.log("Final quote reserves:", daoAfterSpotSwap.amm.state.spot.spot.quoteReserves.toString());

    const finalUserBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const finalUserQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
    console.log("Final user base balance:", finalUserBaseBalance);
    console.log("Final user quote balance:", finalUserQuoteBalance);
    console.log("User base balance change:", finalUserBaseBalance - initialUserBaseBalance);
    console.log("User quote balance change:", finalUserQuoteBalance - initialUserQuoteBalance);

    // // Assert that the spot swap worked correctly
    // assert(daoAfterSpotSwap.amm.state.spot.spot.baseReserves.gt(daoBeforeSpotSwap.amm.state.spot.spot.baseReserves), 
    //        "Base reserves should increase after selling base tokens");
    // assert(daoAfterSpotSwap.amm.state.spot.spot.quoteReserves.lt(daoBeforeSpotSwap.amm.state.spot.spot.quoteReserves), 
    //        "Quote reserves should decrease after selling base tokens");

    return;

    console.log("=== Spot swap assertions passed ===");

    // Split tokens into the vaults
    const { baseVault, quoteVault, question } =
      this.autocratClient.getProposalPdas(proposal, META, USDC, dao);

    await this.vaultClient
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.vaultClient
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    const { passBaseMint, passQuoteMint } =
      this.autocratClient.getProposalPdas(proposal, META, USDC, dao);

    const { failBaseMint, failQuoteMint } = this.autocratClient.getProposalPdas(proposal, META, USDC, dao);

    // Launch the proposal
    await this.autocratClient.autocrat.methods.launchProposal()
      .accounts({
        proposal,
        dao,
        baseVault,
        quoteVault,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, dao, true),
        ammPassQuoteVault: getAssociatedTokenAddressSync(passQuoteMint, dao, true),
        ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, dao, true),
        ammFailQuoteVault: getAssociatedTokenAddressSync(failQuoteMint, dao, true),
        payer: this.payer.publicKey,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })])
      .rpc();

    console.log("=== After launching proposal ===");
    const daoAfterLaunch = await this.autocratClient.autocrat.account.dao.fetch(dao);
    console.log("DAO state:", daoAfterLaunch);

    return;

    // Perform spot swaps to generate TWAP data
    for (let i = 0; i < 10; i++) { // Reduced to 10 for faster testing
      await this.advanceBySlots(20_000n);

      await this.autocratClient.conditionalSwapIx({ 
        dao, 
        baseMint: META, 
        quoteMint: USDC, 
        proposal, 
        market: "pass", 
        swapType: "buy", 
        inputAmount: new BN(10) 
      })
        .preInstructions([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i })])
        .rpc();

      if (i % 5 === 0) {
        console.log(`=== After ${i + 1} swaps ===`);
        const daoAfterSwaps = await this.autocratClient.autocrat.account.dao.fetch(dao);
        console.log("DAO state after swaps:", daoAfterSwaps);
      }
    }

    console.log("=== Final DAO state before finalization ===");
    const finalDaoState = await this.autocratClient.autocrat.account.dao.fetch(dao);
    console.log("Final DAO state:", finalDaoState);

    // Temporary return to see results
    return;

    // Finalize the proposal
    await this.autocratClient.finalizeProposal(proposal);

    const storedProposal = await this.autocratClient.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    // Collect fees
    await this.autocratClient.collectFeesIx({
      dao,
      baseMint: META,
      quoteMint: USDC,
    }).rpc();
  });
}
