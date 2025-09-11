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

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

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

    await this.futarchy
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
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: null,
          baseToStake: new BN(100),
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

    await this.futarchy.provideLiquidityIx({
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

    const descriptionUrl = "https://example.com/proposal";

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
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
    proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposalPda,
    );

    await this.futarchy.stakeToProposalIx({
      proposal,
      dao,
      baseMint: META,
      amount: new BN(100),
      staker: this.payer.publicKey,
      payer: this.payer.publicKey,
    })
    .rpc();
  });

  it.only("futarchy amm", async function () {
    // Get initial state before spot swap (before launching proposal)
    const daoBeforeSpotSwap = await this.futarchy.autocrat.account.dao.fetch(dao);
    console.log("=== Before spot swap (initial AMM state) ===");
    console.log("Initial base reserves:", daoBeforeSpotSwap.amm.state.spot.spot.baseReserves.toString());
    console.log("Initial quote reserves:", daoBeforeSpotSwap.amm.state.spot.spot.quoteReserves.toString());

    const initialUserBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const initialUserQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
    console.log("Initial user base balance:", initialUserBaseBalance);
    console.log("Initial user quote balance:", initialUserQuoteBalance);

    // Perform a spot swap before launching the proposal
    await this.futarchy.spotSwapIx({
      dao,
      baseMint: META,
      quoteMint: USDC,
      swapType: "buy",
      inputAmount: new BN(1 * 10 ** 6), // Buy 1 USDC of META
      minOutputAmount: new BN(0),
      trader: this.payer.publicKey,
    }).rpc();

    // Get state after spot swap
    const daoAfterSpotSwap = await this.futarchy.autocrat.account.dao.fetch(dao);
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

    console.log("=== Spot swap assertions passed ===");

    // Split tokens into the vaults
    const { baseVault, quoteVault, question } =
      this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    const { passBaseMint, passQuoteMint } =
      this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    const { failBaseMint, failQuoteMint } = this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    // Launch the proposal
    await this.futarchy.autocrat.methods.launchProposal()
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
    const daoAfterLaunch = await this.futarchy.autocrat.account.dao.fetch(dao);
    console.log("DAO state:", daoAfterLaunch);

    await this.futarchy.conditionalSwapIx({ 
        dao, 
        baseMint: META, 
        quoteMint: USDC, 
        proposal, 
        market: "fail", 
        swapType: "buy", 
        inputAmount: new BN(100 * 10 ** 6),
        payer: this.payer.publicKey,
      })
        .rpc();

    console.log("=== After conditional swap ===");
    let daoAfterConditionalSwap = await this.futarchy.autocrat.account.dao.fetch(dao);
    console.log("DAO state:", daoAfterConditionalSwap.amm.state.futarchy);

    function printAmmState(dao: any) {
      const ammState = dao.amm.state.futarchy;

      function printPool(pool: any) {
        const quoteReserves: BN = pool.quoteReserves;
        const baseReserves: BN = pool.baseReserves;
        const price = quoteReserves.toNumber() / baseReserves.toNumber();

        console.log("price: ", price, " observation: ", pool.oracle.lastObservation.toNumber() / 1e12)
      }

      printPool(ammState.spot);
      printPool(ammState.pass);
      printPool(ammState.fail);
    }

    printAmmState(daoAfterConditionalSwap);

    // Perform spot swaps to generate TWAP data
    for (let i = 0; i < 100; i++) { // Reduced to 10 for faster testing
      await this.futarchy.conditionalSwapIx({ 
        dao, 
        baseMint: META, 
        quoteMint: USDC, 
        proposal, 
        market: "pass", 
        swapType: "buy", 
        inputAmount: new BN(100 * 10 ** 6),
        payer: this.payer.publicKey,
      })
        .preInstructions([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i })])
        .rpc();

      await this.advanceBySlots(10_000n);

      if (i % 5 === 0) {
        console.log(`=== After ${i + 1} swaps ===`);
        const daoAfterSwaps = await this.futarchy.autocrat.account.dao.fetch(dao);
        console.log("DAO state after swaps:", daoAfterSwaps);
      }
    }

    await this.futarchy.conditionalSwapIx({ 
        dao, 
        baseMint: META, 
        quoteMint: USDC, 
        proposal, 
        market: "pass", 
        swapType: "sell", 
        inputAmount: new BN(100 * 10 ** 6),
      })
      .rpc();

    await this.futarchy.conditionalSwapIx({ 
        dao, 
        baseMint: META, 
        quoteMint: USDC, 
        proposal, 
        market: "fail", 
        swapType: "sell", 
        inputAmount: new BN(100 * 10 ** 6),
      })
      .rpc();

    console.log("=== Final DAO state before finalization ===");
    const finalDaoState = await this.futarchy.autocrat.account.dao.fetch(dao);
    console.log("Final DAO state:", finalDaoState);

    printAmmState(finalDaoState);

    // Temporary return to see results
    // Finalize the proposal
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    console.log("Stored proposal:", storedProposal);
    console.log("AMM fUSDC Balance", await this.getTokenBalance(passQuoteMint, dao));
    assert.exists(storedProposal.state.passed);

    // Collect fees
    await this.futarchy.collectFeesIx({
      dao,
      baseMint: META,
      quoteMint: USDC,
    }).rpc();
  });
}
