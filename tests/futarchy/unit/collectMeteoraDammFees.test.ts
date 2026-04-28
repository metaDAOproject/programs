import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  DAMM_V2_PROGRAM_ID,
  FutarchyClient,
  LaunchpadClient,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
  PERMISSIONLESS_ACCOUNT,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/futarchy";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../../launchpad_v7/utils.js";
import { createLookupTableForTransaction } from "../../utils.js";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v7,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: this.payer.publicKey,
        approvedAmount: minRaise,
        launchAuthority: this.payer.publicKey,
      })
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: this.payer.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);
  });

  it("collects Meteora DAMM fees successfully after a successful launch", async function () {
    const payerUsdcTokenAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
      true,
    );
    const payerMetaTokenAccount = getAssociatedTokenAddressSync(
      META,
      this.payer.publicKey,
      true,
    );

    let payerUsdcTokenBalanceBeforeSwap = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    let payerMetaTokenBalanceBeforeSwap = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // Assert that the payer has no META tokens before the swap
    assert.equal(payerMetaTokenBalanceBeforeSwap, 0n);

    ///////////////////////////
    // Swap to generate fees //
    ///////////////////////////

    // Helper function to sort mints for Meteora pool PDA
    const sortMints = (
      mint1: PublicKey,
      mint2: PublicKey,
    ): [Buffer, Buffer] => {
      const buf1 = mint1.toBuffer();
      const buf2 = mint2.toBuffer();
      if (Buffer.compare(buf1, buf2) > 0) {
        return [buf1, buf2];
      }
      return [buf2, buf1];
    };

    const [sortedMint1, sortedMint2] = sortMints(MAINNET_USDC, META);

    const cpAmm = new CpAmm(this.squadsConnection);

    const [pool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG.toBuffer(),
        sortedMint1,
        sortedMint2,
      ],
      DAMM_V2_PROGRAM_ID,
    );

    const swapTx = await cpAmm._program.methods
      .swap({
        amountIn: new BN(1_000_000), // 1 USDC swap
        minimumAmountOut: new BN(0),
      })
      .accounts({
        tokenAMint: META,
        tokenBMint: MAINNET_USDC,
        tokenAProgram: TOKEN_PROGRAM_ID,
        tokenBProgram: TOKEN_PROGRAM_ID,
        referralTokenAccount: null,
        inputTokenAccount: payerUsdcTokenAccount,
        outputTokenAccount: payerMetaTokenAccount,
        payer: this.payer.publicKey,
        pool: pool,
        program: DAMM_V2_PROGRAM_ID,
      })
      .transaction();

    swapTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    swapTx.feePayer = this.payer.publicKey;
    swapTx.sign(this.payer);

    await this.banksClient.processTransaction(swapTx);

    let payerUsdcTokenBalanceAfterSwap = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    let payerMetaTokenBalanceAfterSwap = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // Payer spent 1 USDC for swap
    assert.equal(
      payerUsdcTokenBalanceAfterSwap,
      payerUsdcTokenBalanceBeforeSwap - 1_000_000n,
    );
    // Payer received META tokens from swap
    assert(payerMetaTokenBalanceAfterSwap > 0n);

    //////////////////
    // Extract fees //
    //////////////////

    const launchAccount = await launchpadClient.fetchLaunch(launch);

    let daoAccount = await futarchyClient.getDao(launchAccount.dao);

    const squadsMultisigAccount =
      await multisig.accounts.Multisig.fromAccountAddress(
        this.squadsConnection,
        daoAccount.squadsMultisig,
      );

    const metaDaoBaseTokenAccount = getAssociatedTokenAddressSync(
      META,
      METADAO_MULTISIG_VAULT,
      true,
    );

    const metaDaoQuoteTokenAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      METADAO_MULTISIG_VAULT,
      true,
    );

    const metaDaoBaseTokenBalanceBeforeCollect = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );
    const metaDaoQuoteTokenBalanceBeforeCollect = await this.getTokenBalance(
      MAINNET_USDC,
      METADAO_MULTISIG_VAULT,
    );

    assert.equal(metaDaoBaseTokenBalanceBeforeCollect, 0n);
    assert.equal(metaDaoQuoteTokenBalanceBeforeCollect, 0n);

    const tx = new Transaction()
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
          MAINNET_USDC,
        ),
      );

    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    await this.banksClient.processTransaction(tx);

    daoAccount = await futarchyClient.getDao(launchAccount.dao);

    const daoSeqNumBeforeCollect = daoAccount.seqNum;

    await futarchyClient
      .collectMeteoraDammFeesIx({
        dao: launchAccount.dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        transactionIndex:
          BigInt(squadsMultisigAccount.transactionIndex.toString()) + 1n,
        meteoraConfig: LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
        admin: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 }),
      ])
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    daoAccount = await futarchyClient.getDao(launchAccount.dao);

    const daoSeqNumAfterCollect = daoAccount.seqNum;

    // Assert that the DAO sequence number was incremented
    assert.equal(
      daoSeqNumAfterCollect.toString(),
      daoSeqNumBeforeCollect.add(new BN(1)).toString(),
    );

    const metaDaoBaseTokenBalanceAfterCollect = await this.getTokenBalance(
      META,
      METADAO_MULTISIG_VAULT,
    );
    const metaDaoQuoteTokenBalanceAfterCollect = await this.getTokenBalance(
      MAINNET_USDC,
      METADAO_MULTISIG_VAULT,
    );

    // MetaDAO received base tokens from swap
    assert(metaDaoBaseTokenBalanceAfterCollect > 0n);
    // MetaDAO received no quote tokens from swap, as the swap was not in that direction
    assert.equal(metaDaoQuoteTokenBalanceAfterCollect, 0n);
  });
}
