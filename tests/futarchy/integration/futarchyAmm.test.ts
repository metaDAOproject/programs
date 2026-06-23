import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      1000_000_000 * 10 ** 9,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      1_000_000_000 * 1_000_000,
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

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          baseToStake: null,
          twapStartDelaySeconds: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
          isProposalValidationEnabled: null,
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

    // Now initialize the futarchy proposal
    proposal = await this.futarchy.initializeProposal(dao, squadsProposalPda);

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: new BN(100),
        staker: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc();
  });

  it("futarchy amm", async function () {
    // Get initial state before spot swap (before launching proposal)
    const daoBeforeSpotSwap =
      await this.futarchy.futarchy.account.dao.fetch(dao);

    const initialUserBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    const initialUserQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );

    // Perform a spot swap before launching the proposal
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1 * 10 ** 6), // Buy 1 USDC of META
        minOutputAmount: new BN(0),
        trader: this.payer.publicKey,
      })
      .rpc();

    // Get state after spot swap
    const daoAfterSpotSwap =
      await this.futarchy.futarchy.account.dao.fetch(dao);

    const finalUserBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    const finalUserQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    // // Assert that the spot swap worked correctly
    // assert(daoAfterSpotSwap.amm.state.spot.spot.baseReserves.gt(daoBeforeSpotSwap.amm.state.spot.spot.baseReserves),
    //        "Base reserves should increase after selling base tokens");
    // assert(daoAfterSpotSwap.amm.state.spot.spot.quoteReserves.lt(daoBeforeSpotSwap.amm.state.spot.spot.quoteReserves),
    //        "Quote reserves should decrease after selling base tokens");

    // Split tokens into the vaults
    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    const { passBaseMint, passQuoteMint } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    const { failBaseMint, failQuoteMint } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    const proposalAccount = await this.futarchy.getProposal(proposal);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: proposalAccount.squadsProposal,
      })
      .rpc();

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // Perform spot swaps to generate TWAP data
    for (let i = 0; i < 100; i++) {
      // Reduced to 10 for faster testing
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
          payer: this.payer.publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    // Create ATAs for METADAO_MULTISIG_VAULT before collecting fees
    const metaDaoBaseTokenAccount = getAssociatedTokenAddressSync(
      META,
      METADAO_MULTISIG_VAULT,
      true,
    );
    const metaDaoQuoteTokenAccount = getAssociatedTokenAddressSync(
      USDC,
      METADAO_MULTISIG_VAULT,
      true,
    );

    const createAtasTx = new Transaction()
      .add(
        createAssociatedTokenAccountIdempotentInstruction(
          this.payer.publicKey,
          metaDaoBaseTokenAccount,
          METADAO_MULTISIG_VAULT,
          META,
        ),
      )
      .add(
        createAssociatedTokenAccountIdempotentInstruction(
          this.payer.publicKey,
          metaDaoQuoteTokenAccount,
          METADAO_MULTISIG_VAULT,
          USDC,
        ),
      );

    createAtasTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createAtasTx.feePayer = this.payer.publicKey;
    createAtasTx.sign(this.payer);

    await this.banksClient.processTransaction(createAtasTx);

    // Get pre-balances of METADAO_MULTISIG_VAULT
    const preBaseBalance = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );
    const preQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );

    // Collect fees
    await this.futarchy
      .collectFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc();

    // Get post-balances of METADAO_MULTISIG_VAULT
    const postBaseBalance = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );
    const postQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );

    // Verify fees were collected to METADAO_MULTISIG_VAULT
    assert(
      postBaseBalance > preBaseBalance || postQuoteBalance > preQuoteBalance,
      "Fees should have been collected to METADAO_MULTISIG_VAULT",
    );
  });
}
