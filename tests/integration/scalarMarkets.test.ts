import {
  ConditionalVaultClient,
  AmmClient,
  getAmmAddr,
  SwapType,
  InstructionUtils,
} from "@metadaoproject/futarchy/v0.4";
import { sha256 } from "@noble/hashes/sha256";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import {
  getAccount,
} from "spl-token-bankrun";

export default async function test() {
  let vaultClient: ConditionalVaultClient = this.vaultClient;
  let ammClient: AmmClient = this.ammClient;

  let bob: Keypair = Keypair.generate();
  let carol: Keypair = Keypair.generate();
  let dan: Keypair = Keypair.generate();
  let alice: Keypair = Keypair.generate();
  let operator: Keypair = Keypair.generate();

  //tests varying numOutcomes TODO: get back to this once we figure out how to create markets with more than 2 outcomes

  const colors = ["red", "blue", "green", "yellow", "purple"];
  for (let i = 2; i <= 5; i++) {
    let question: PublicKey = await vaultClient.initializeQuestion(
      sha256(
        new TextEncoder().encode(
          "What is the color of the sky?" +
            colors
              .slice(0, i)
              .map((color) => `/${color}`)
              .join("")
        )
      ),
      operator.publicKey,
      i // numOutcomes
    );
    let USDC: PublicKey = await this.createMint(operator.publicKey, 6);
    await this.createTokenAccount(USDC, this.payer.publicKey);
    await this.mintTo(USDC, this.payer.publicKey, operator, 10000 * 10 ** 6);
    const vault = await vaultClient.initializeVault(question, USDC, i);
    const storedVault = await vaultClient.fetchVault(vault);
    const conditionalTokenMints = storedVault.conditionalTokenMints;
    assert.isTrue(conditionalTokenMints.length === i);

    for (let j = 0; j < i; j++) {
      await this.createTokenAccount(conditionalTokenMints[j], alice.publicKey);
    }
  }

  const numOutcomes = 2;

  let question: PublicKey = await vaultClient.initializeQuestion(
    sha256(new TextEncoder().encode("Will Donald Trump get the W?/YES/NO")),
    operator.publicKey,
    numOutcomes
  );

  let USDC: PublicKey = await this.createMint(operator.publicKey, 6);

  const usdcAccount = await this.createTokenAccount(USDC, this.payer.publicKey);
  const payerMintAmount = 10000000 * 10 ** 6;
  await this.mintTo(USDC, this.payer.publicKey, operator, payerMintAmount);

  const usdcMintAmount = 10000000 * 10 ** 6;
  this.createTokenAccount(USDC, alice.publicKey);
  await this.mintTo(USDC, alice.publicKey, operator, usdcMintAmount);

  this.createTokenAccount(USDC, bob.publicKey);
  await this.mintTo(USDC, bob.publicKey, operator, usdcMintAmount);

  this.createTokenAccount(USDC, carol.publicKey);
  await this.mintTo(USDC, carol.publicKey, operator, usdcMintAmount);

  this.createTokenAccount(USDC, dan.publicKey);
  await this.mintTo(USDC, dan.publicKey, operator, usdcMintAmount);

  const vault = await vaultClient.initializeVault(question, USDC, numOutcomes);
  const storedVault = await vaultClient.fetchVault(vault);

  const YES = storedVault.conditionalTokenMints[0];
  const NO = storedVault.conditionalTokenMints[1];

  // Initialize AMM
  await ammClient.initializeAmmIx(YES, NO, new BN(0), new BN(100), new BN(1000)).rpc();
  const amm = getAmmAddr(ammClient.getProgramId(), YES, NO)[0];

  // Create token accounts for Alice, Bob, Carol, and Dan
  await this.createTokenAccount(YES, alice.publicKey);
  await this.createTokenAccount(NO, alice.publicKey);
  await this.createTokenAccount(YES, bob.publicKey);
  await this.createTokenAccount(NO, bob.publicKey);
  await this.createTokenAccount(YES, carol.publicKey);
  await this.createTokenAccount(NO, carol.publicKey);
  await this.createTokenAccount(YES, dan.publicKey);
  await this.createTokenAccount(NO, dan.publicKey);

  //ensure addLiquidityIx fails with 0 amounts
  let failed = false;
  try {
    await ammClient
      .addLiquidityIx(
        amm,
        YES,
        NO,
        new BN(0),
        new BN(0),
        new BN(numOutcomes),
        this.payer.publicKey
      )
      .rpc();
  } catch (e) {
    failed = true;
  }
  assert.isTrue(failed, "addLiquidityIx should fail with 0 amounts");

  //ensure splitTokensIx gives 0 yes and no tokens with 0 usdc
  failed = false;
  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(0),
      numOutcomes,
      alice.publicKey
    )
    .signers([alice])
    .rpc();
  let yesBalance = await this.getTokenBalance(YES, alice.publicKey);
  let noBalance = await this.getTokenBalance(NO, alice.publicKey);
  assert.equal(yesBalance, new BN(0), "YES balance should be 0");
  assert.equal(noBalance, new BN(0), "NO balance should be 0");

  // return;
  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(1000 * 10 ** 6),
      numOutcomes,
      this.payer.publicKey
    )
    .rpc();
  await ammClient
    .addLiquidityIx(
      amm,
      YES,
      NO,
      new BN(500 * 10 ** 6),
      new BN(500 * 10 ** 6),
      new BN(0)
    )
    .rpc();

  //perform splitTokensIx for bob
  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(1000 * 10 ** 6),
      numOutcomes,
      bob.publicKey
    )
    .signers([bob])
    .rpc();
  yesBalance = await this.getTokenBalance(YES, bob.publicKey);
  noBalance = await this.getTokenBalance(NO, bob.publicKey);
  assert.equal(
    yesBalance,
    new BN(1000 * 10 ** 6),
    "YES balance for bob should be 1000"
  );
  assert.equal(
    noBalance,
    new BN(1000 * 10 ** 6),
    "NO balance for bob should be 1000"
  );

  //try to to swap with 0 amount
  failed = false;
  try {
    await ammClient
      .swapIx(amm, YES, NO, { buy: {} }, new BN(0), new BN(1), bob.publicKey)
      .signers([bob])
      .rpc();
  } catch (e) {
    failed = true;
  }
  assert.isTrue(failed, "swapIx should fail with 0 amount");

  //mint and swap with random amounts and random users and check balances of pool at the end
  let totalMintAmount = 0;
  let totalBuySwapAmount = 0;
  let totalSellSwapAmount = 0;
  let randomUsers = [alice, bob, carol, dan];
  let numSwaps = 50;
  for (let i = 0; i < numSwaps; i++) {
    let randomUser = randomUsers[i % randomUsers.length];
    let randomMintAmount = new BN(Math.floor(Math.random() * 100000 * 10 ** 6));
    totalMintAmount += Number(randomMintAmount);
    let randomSwapAmount = new BN(
      Math.floor(Math.random() * randomMintAmount.toNumber())
    );
    const swapDirectionBool = Math.random() < 0.5;
    const swapDirection = swapDirectionBool ? { buy: {} } : { sell: {} };
    let mintTx = vaultClient.splitTokensIx(
      question,
      vault,
      USDC,
      randomMintAmount,
      numOutcomes,
      randomUser.publicKey
    );

    let swapTx = ammClient.swapIx(
      amm,
      YES,
      NO,
      swapDirection as SwapType,
      randomSwapAmount,
      new BN(1),
      randomUser.publicKey
    );

    let usdcBalanceBefore = await this.getTokenBalance(
      USDC,
      randomUser.publicKey
    );
    let yesBalanceBefore = await this.getTokenBalance(
      YES,
      randomUser.publicKey
    );
    yesBalanceBefore = new BN(yesBalanceBefore).add(randomMintAmount);
    let noBalanceBefore = await this.getTokenBalance(NO, randomUser.publicKey);
    noBalanceBefore = new BN(noBalanceBefore).add(randomMintAmount);

    let instructions = await InstructionUtils.getInstructions(mintTx, swapTx);
    let tx = new Transaction().add(...instructions);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, randomUser);
    await this.banksClient.processTransaction(tx);

    let usdcBalanceAfter = await this.getTokenBalance(
      USDC,
      randomUser.publicKey
    );
    let yesBalanceAfter = await this.getTokenBalance(YES, randomUser.publicKey);
    let noBalanceAfter = await this.getTokenBalance(NO, randomUser.publicKey);

    let yesDiff = Number(yesBalanceAfter) - Number(yesBalanceBefore);
    let noDiff = Number(noBalanceAfter) - Number(noBalanceBefore);

    assert.equal(
      usdcBalanceBefore - usdcBalanceAfter,
      randomMintAmount.toNumber()
    );
    if (swapDirectionBool) {
      totalBuySwapAmount += Number(randomSwapAmount);
      assert.equal(
        Math.abs(noDiff),
        randomSwapAmount.toNumber(),
        "noBalance should decrease by swap amount if buy"
      );
      assert.isTrue(yesDiff > 0, "yes balance should increase after a buy");
    } else {
      totalSellSwapAmount += Number(randomSwapAmount);
      assert.equal(
        Math.abs(yesDiff),
        randomSwapAmount.toNumber(),
        "yesBalance should decrease by swap amount if sell"
      );
      assert.isTrue(noDiff > 0, "no balance should increase after a sell");
    }
  }

  // Merge tokens for some users
  for (let i = 0; i < Math.floor(randomUsers.length / 2); i++) {
    const randomUser = randomUsers[i];

    // Get current YES and NO token balances
    const yesBalance = await this.getTokenBalance(YES, randomUser.publicKey);
    const noBalance = await this.getTokenBalance(NO, randomUser.publicKey);
    const balanceToMerge = Math.min(Number(yesBalance), Number(noBalance));

    // Create merge instructions for both YES and NO tokens
    await vaultClient
      .mergeTokensIx(
        question,
        vault,
        USDC,
        new BN(balanceToMerge),
        numOutcomes,
        randomUser.publicKey
      )
      .signers([randomUser])
      .rpc();
  }

  // Resolve question
  await vaultClient
    .resolveQuestionIx(question, operator, [243, 117])
    .signers([operator])
    .rpc();

  // Verify question state
  let storedQuestion = await vaultClient.fetchQuestion(question);
  assert.deepEqual(storedQuestion.payoutNumerators, [243, 117]);
  assert.equal(storedQuestion.payoutDenominator, 117 + 243);

  //withdraw liquidity
  const ammStart = await ammClient.getAmm(amm);
  let userLpAccount = token.getAssociatedTokenAddressSync(
    ammStart.lpMint,
    this.payer.publicKey
  );
  const userLpAccountStart = await getAccount(this.banksClient, userLpAccount);
  await ammClient
    .removeLiquidityIx(
      amm,
      YES,
      NO,
      new BN(userLpAccountStart.amount.toString()),
      new BN(1),
      new BN(1)
    )
    .rpc();

  // Redeem tokens for each random user - redeeming after merging should do nothing.
  let endingBalances = [];
  let allUsers = randomUsers.concat([this.payer]);
  for (let i = 0; i < allUsers.length; i++) {
    const randomUser = allUsers[i];

    // Redeem both YES and NO tokens
    await vaultClient
      .redeemTokensIx(question, vault, USDC, numOutcomes, randomUser.publicKey)
      .signers([randomUser])
      .rpc();

    // Verify USDC balance after redeem
    const usdcBalanceAfterRedeem = await this.getTokenBalance(
      USDC,
      randomUser.publicKey
    );
    endingBalances.push(Number(usdcBalanceAfterRedeem));
  }

  const totalEndingBalance = endingBalances.reduce((a, b) => a + b, 0);

  assert.isTrue(
    usdcMintAmount * 5 >= totalEndingBalance &&
      usdcMintAmount * 5 * 0.9999 < totalEndingBalance
  );
}
