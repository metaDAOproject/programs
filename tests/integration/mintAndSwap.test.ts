import {
  ConditionalVaultClient,
  FutarchyClient,
  InstructionUtils,
} from "@metadaoproject/futarchy-v2";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";

export default async function test() {
  const vaultClient: ConditionalVaultClient = this.conditionalVault;
  const futarchyClient: FutarchyClient = this.futarchy;

  // Create mints and token accounts
  const META: PublicKey = await this.createMint(this.payer.publicKey, 6);
  const USDC: PublicKey = await this.createMint(this.payer.publicKey, 6);

  await this.createTokenAccount(META, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(
    USDC,
    this.payer.publicKey,
    this.payer,
    100_000 * 1_000_000,
  );

  // Initialize DAO
  const nonce = new BN(Math.floor(Math.random() * 1000000));

  await futarchyClient
    .initializeDaoIx({
      baseMint: META,
      quoteMint: USDC,
      params: {
        secondsPerProposal: 60 * 60 * 24 * 3,
        twapStartDelaySeconds: 60 * 60 * 24,
        twapInitialObservation: new BN(1000 * 10 ** 6),
        twapMaxObservationChangePerUpdate: new BN(10 * 10 ** 6),
        minQuoteFutarchicLiquidity: new BN(10_000),
        minBaseFutarchicLiquidity: new BN(10_000),
        passThresholdBps: 300,
        nonce,
        initialSpendingLimit: null,
        baseToStake: new BN(0),
      },
      provideLiquidity: false,
    })
    .rpc();

  const [dao] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("dao"),
      this.payer.publicKey.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    futarchyClient.getProgramId(),
  );

  // Provide liquidity to DAO AMM
  await futarchyClient
    .provideLiquidityIx({
      dao,
      baseMint: META,
      quoteMint: USDC,
      quoteAmount: new BN(50_000 * 10 ** 6), // 50,000 USDC
      maxBaseAmount: new BN(50 * 10 ** 6), // 50 META
      minLiquidity: new BN(0),
      positionAuthority: this.payer.publicKey,
      liquidityProvider: this.payer.publicKey,
    })
    .rpc();

  // Test spot swap functionality - buy META with USDC
  const initialUsdcBalance = await this.getTokenBalance(
    USDC,
    this.payer.publicKey,
  );
  const initialMetaBalance = await this.getTokenBalance(
    META,
    this.payer.publicKey,
  );

  const swapAmount = new BN(1_000 * 1_000_000); // 1,000 USDC

  const swapTx = futarchyClient.spotSwapIx({
    dao,
    baseMint: META,
    quoteMint: USDC,
    swapType: "buy",
    inputAmount: swapAmount,
    minOutputAmount: new BN(0),
    trader: this.payer.publicKey,
  });

  const instructions = await InstructionUtils.getInstructions(swapTx);

  const tx = new Transaction().add(...instructions);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer);

  await this.banksClient.processTransaction(tx);

  // Assert balances changed
  const finalUsdcBalance = await this.getTokenBalance(
    USDC,
    this.payer.publicKey,
  );
  const finalMetaBalance = await this.getTokenBalance(
    META,
    this.payer.publicKey,
  );

  assert.isBelow(
    Number(finalUsdcBalance),
    Number(initialUsdcBalance),
    "USDC balance should decrease after buying META",
  );

  assert.isAbove(
    Number(finalMetaBalance),
    Number(initialMetaBalance),
    "META balance should increase after buying META",
  );

  // Test sell swap as well
  const sellAmount = new BN(1 * 10 ** 6); // 1 META

  const sellTx = futarchyClient.spotSwapIx({
    dao,
    baseMint: META,
    quoteMint: USDC,
    swapType: "sell",
    inputAmount: sellAmount,
    minOutputAmount: new BN(0),
    trader: this.payer.publicKey,
  });

  await sellTx.rpc();

  // Check balances changed again
  const finalUsdcBalance2 = await this.getTokenBalance(
    USDC,
    this.payer.publicKey,
  );
  const finalMetaBalance2 = await this.getTokenBalance(
    META,
    this.payer.publicKey,
  );

  assert.isAbove(
    Number(finalUsdcBalance2),
    Number(finalUsdcBalance),
    "USDC balance should increase after selling META",
  );

  assert.isBelow(
    Number(finalMetaBalance2),
    Number(finalMetaBalance),
    "META balance should decrease after selling META",
  );
}
