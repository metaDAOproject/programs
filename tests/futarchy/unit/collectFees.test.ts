import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { expectError, setupBasicDao } from "../../utils.js";
import BN from "bn.js";
import { assert } from "chai";
import { METADAO_MULTISIG_VAULT } from "@metadaoproject/programs";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(USDC, this.payer.publicKey, this.payer, 100 * 10 ** 6);
    await this.mintTo(META, this.payer.publicKey, this.payer, 10 * 10 ** 6);

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("collects fees", async function () {
    // they buy 100 USDC worth, then sell 2 META worth. so we should collect 0.25 USDC and 0.005 META

    // Get the ATA addresses for METADAO_MULTISIG_VAULT
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

    // Create ATAs for METADAO_MULTISIG_VAULT in a separate transaction first
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

    // Do swaps to generate fees
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(100 * 10 ** 6),
        minOutputAmount: new BN(0),
      })
      .rpc();

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "sell",
        inputAmount: new BN(2 * 10 ** 6),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // Get pre-balances
    const preQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );
    const preBaseBalance = await this.getTokenBalance(
      META,
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

    // Get post-balances
    const postQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );
    const postBaseBalance = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );

    const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
    const baseFeesCollected = postBaseBalance - preBaseBalance;

    assert.equal(quoteFeesCollected, 500_000n);
    assert.equal(baseFeesCollected, 10_000n);
  });

  it("fails when the pool is not in the spot state", async function () {
    // Get the ATA addresses for METADAO_MULTISIG_VAULT
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

    // Create ATAs for METADAO_MULTISIG_VAULT in a separate transaction first
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

    const { proposal, question, baseVault, squadsProposal } =
      await this.initializeAndLaunchProposal({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("hello, world"),
          },
        ],
      });

    const { failQuoteMint } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(5 * 10 ** 6), 2)
      .rpc();

    // here we literally swap 1 atom of META, which should result in one atom of META fee because we round up

    this.advanceBySeconds(60 * 60 * 24 * 11);

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "fail",
        swapType: "sell",
        inputAmount: new BN(1),
        minOutputAmount: new BN(0),
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.payer.publicKey,
          getAssociatedTokenAddressSync(
            failQuoteMint,
            this.payer.publicKey,
            true,
          ),
          this.payer.publicKey,
          failQuoteMint,
        ),
      ])
      .rpc();

    const callbacks = expectError(
      "PoolNotInSpotState",
      "fee collect worked on a futarchy pool",
    );

    await this.futarchy
      .collectFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc();

    const preQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );
    const preBaseBalance = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );

    await this.futarchy
      .collectFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const postQuoteBalance = await this.getTokenBalance(
      USDC,
      METADAO_MULTISIG_VAULT,
    );
    const postBaseBalance = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );

    const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
    const baseFeesCollected = postBaseBalance - preBaseBalance;

    assert.equal(quoteFeesCollected, 0n);
    assert.equal(baseFeesCollected, 1n);
  });
}
