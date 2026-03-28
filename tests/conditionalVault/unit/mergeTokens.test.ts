import { sha256, ConditionalVaultClient } from "@metadaoproject/futarchy-v2";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
} from "spl-token-bankrun";
import * as token from "@solana/spl-token";
import { expectError } from "../../utils.js";
import { BN } from "bn.js";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let question: PublicKey;
  let vault: PublicKey;
  let underlyingTokenMint: PublicKey;
  let userUnderlyingTokenAccount: PublicKey;
  let oracle: Keypair;

  before(function () {
    vaultClient = this.conditionalVault;
  });

  beforeEach(async function () {
    const questionId = sha256(new Uint8Array([9, 2, 1]));
    oracle = Keypair.generate();

    question = await vaultClient.initializeQuestion(
      questionId,
      oracle.publicKey,
      2,
    );

    underlyingTokenMint = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      null,
      8,
    );

    vault = await vaultClient.initializeVault(question, underlyingTokenMint, 2);

    userUnderlyingTokenAccount = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      underlyingTokenMint,
      this.payer.publicKey,
    );

    // Mint some underlying tokens to the user's account
    await mintTo(
      this.banksClient,
      this.payer,
      underlyingTokenMint,
      userUnderlyingTokenAccount,
      this.payer,
      1000,
    );

    await vaultClient
      .splitTokensIx(question, vault, underlyingTokenMint, new BN(1000), 2)
      .rpc();
  });

  it("merges tokens", async function () {
    const balanceBefore = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);
    await vaultClient
      .mergeTokensIx(question, vault, underlyingTokenMint, new BN(600), 2)
      .rpc();
    const balanceAfter = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 600);
    const updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "2");
  });

  it("throws error when trying to merge more tokens than available", async function () {
    const callbacks = expectError(
      "InsufficientConditionalTokens",
      "merge succeeded despite insufficient conditional tokens",
    );

    await vaultClient
      .mergeTokensIx(question, vault, underlyingTokenMint, new BN(2000), 2)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("successfully calls mergeTokens consecutively", async function () {
    let balanceBefore = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);
    await vaultClient
      .mergeTokensIx(question, vault, underlyingTokenMint, new BN(500), 2)
      .rpc();
    let balanceAfter = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 500);
    let updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "2");

    balanceBefore = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);
    await vaultClient
      .mergeTokensIx(question, vault, underlyingTokenMint, new BN(500), 2)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();
    balanceAfter = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        underlyingTokenMint,
        this.payer.publicKey,
      ),
    ).then((acc) => acc.amount);

    assert.isTrue(balanceAfter > balanceBefore);
    assert.equal(balanceAfter - balanceBefore, 500);
    updatedVault = await vaultClient.fetchVault(vault);
    assert.equal(updatedVault.seqNum.toString(), "3");
  });

  it("throws error when trying to merge tokens after question is resolved", async function () {
    // Resolve the question
    await vaultClient.vaultProgram.methods
      .resolveQuestion({ payoutNumerators: [1, 0] })
      .accounts({
        question,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();

    // Attempt to merge tokens after resolution should fail
    const callbacks = expectError(
      "QuestionAlreadyResolved",
      "merge succeeded despite question being resolved",
    );

    await vaultClient
      .mergeTokensIx(question, vault, underlyingTokenMint, new BN(500), 2)
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
