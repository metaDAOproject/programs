import { sha256 } from "@metadaoproject/futarchy";
import { ConditionalVaultClient } from "@metadaoproject/futarchy/v0.4";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BN } from "bn.js";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let question: PublicKey;
  let vault: PublicKey;
  let underlyingTokenMint: PublicKey;
  let settlementAuthority: Keypair;
  let userUnderlyingTokenAccount: PublicKey;

  before(function () {
    vaultClient = this.vaultClient;
  });

  beforeEach(async function () {
    let questionId = sha256(new Uint8Array([9, 28, 2, 1]));
    settlementAuthority = Keypair.generate();

    question = await vaultClient.initializeQuestion(
      questionId,
      settlementAuthority.publicKey,
      2
    );

    underlyingTokenMint = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      null,
      8
    );

    vault = await vaultClient.initializeVault(question, underlyingTokenMint, 2);

    userUnderlyingTokenAccount = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      underlyingTokenMint,
      this.payer.publicKey
    );

    // Mint some underlying tokens to the user's account
    await mintTo(
      this.banksClient,
      this.payer,
      underlyingTokenMint,
      userUnderlyingTokenAccount,
      this.payer,
      1000
    );

    await vaultClient
      .splitTokensIx(question, vault, underlyingTokenMint, new BN(1000), 2)
      .rpc();
  });

  it("can't redeem tokens when question is not resolved", async function () {
    try {
      await vaultClient
        .redeemTokensIx(question, vault, underlyingTokenMint, 2)
        .rpc();
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.include(error.message, "CantRedeemConditionalTokens");
    }
  });

  it("can redeem tokens when question is resolved", async function () {
    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [1, 0])
      .rpc();

    const underlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      this.payer.publicKey
    );

    const balanceBefore = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    await vaultClient
      .redeemTokensIx(question, vault, underlyingTokenMint, 2)
      .rpc();

    const balanceAfter = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 1000);

    const updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "2");
  });

  it("redeeming tokens a second time should do nothing", async function () {
    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [1, 0])
      .rpc();

    const underlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      this.payer.publicKey
    );

    const balanceBefore = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    await vaultClient
      .redeemTokensIx(question, vault, underlyingTokenMint, 2)
      .preInstructions([
        // To prevent the test from failing due to thinking it has already processed the instruction
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    let balanceAfter = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    // console.log('balanceAfter', balanceAfter);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 1000);

    let updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "2");

    await vaultClient
      .redeemTokensIx(question, vault, underlyingTokenMint, 2)
      .rpc();

    balanceAfter = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    // console.log('balanceAfter', balanceAfter);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 1000);

    updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "3");
  });

  it("redeeming tokens should leave some dust from rounding down", async function () {
    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [2, 1])
      .rpc();

    const underlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      this.payer.publicKey
    );

    const balanceBefore = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    await vaultClient
      .redeemTokensIx(question, vault, underlyingTokenMint, 2)
      .rpc();

    const balanceAfter = await getAccount(
      this.banksClient,
      underlyingTokenAccount
    ).then((acc) => acc.amount);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.isTrue(balanceAfter - balanceBefore < 1000); //dont need both these checks lol but just in case
    assert.isTrue(balanceAfter - balanceBefore == 999);

    // console.log('balanceAfter', balanceAfter);

    const updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "2");
  });
}
