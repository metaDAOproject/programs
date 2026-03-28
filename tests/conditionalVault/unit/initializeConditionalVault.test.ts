import {
  ConditionalVaultClient,
  getVaultAddr,
  getConditionalTokenMintAddr,
  sha256,
} from "@metadaoproject/futarchy-v2";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getMint } from "spl-token-bankrun";
import * as token from "@solana/spl-token";
import { expectError } from "../../utils.js";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let underlyingTokenMint: PublicKey;

  before(async function () {
    vaultClient = this.conditionalVault;
    underlyingTokenMint = await createMint(
      this.banksClient,
      this.payer as Keypair,
      Keypair.generate().publicKey,
      null,
      8,
    );
  });

  const testCases = [
    { name: "2-outcome question", idArray: [3, 2, 1], outcomes: 2 },
    { name: "3-outcome question", idArray: [4, 5, 6], outcomes: 3 },
    { name: "4-outcome question", idArray: [7, 8, 9], outcomes: 4 },
  ];

  testCases.forEach(({ name, idArray, outcomes }) => {
    describe(name, function () {
      it("initializes vaults correctly", async function () {
        const oracle = Keypair.generate();
        const questionId = sha256(new Uint8Array(idArray));
        const question = await vaultClient.initializeQuestion(
          questionId,
          oracle.publicKey,
          outcomes,
        );

        await vaultClient
          .initializeVaultIx(question, underlyingTokenMint, outcomes)
          .rpc();

        const [vault, pdaBump] = getVaultAddr(
          vaultClient.vaultProgram.programId,
          question,
          underlyingTokenMint,
        );

        const storedVault = await vaultClient.fetchVault(vault);
        assert.ok(storedVault.question.equals(question));
        assert.ok(storedVault.underlyingTokenMint.equals(underlyingTokenMint));

        const vaultUnderlyingTokenAccount = token.getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true,
        );
        assert.ok(
          storedVault.underlyingTokenAccount.equals(
            vaultUnderlyingTokenAccount,
          ),
        );
        const storedConditionalTokenMints = storedVault.conditionalTokenMints;
        storedConditionalTokenMints.forEach((mint, i) => {
          const [expectedMint] = getConditionalTokenMintAddr(
            vaultClient.vaultProgram.programId,
            vault,
            i,
          );
          assert.ok(mint.equals(expectedMint));
        });
        assert.equal(storedVault.pdaBump, pdaBump);
        assert.equal(storedVault.decimals, 8);
        assert.equal(storedVault.seqNum.toString(), "0");

        for (const mint of storedConditionalTokenMints) {
          const storedMint = await getMint(this.banksClient, mint);
          assert.ok(storedMint.mintAuthority.equals(vault));
          assert.equal(storedMint.supply.toString(), "0");
          assert.equal(storedMint.decimals, 8);
          assert.isNull(storedMint.freezeAuthority);
        }
      });

      it("doesn't allow initializing vault for resolved question", async function () {
        const oracle = Keypair.generate();
        const questionId = sha256(new Uint8Array(idArray));
        const question = await vaultClient.initializeQuestion(
          questionId,
          oracle.publicKey,
          outcomes,
        );

        await vaultClient
          .resolveQuestionIx(question, oracle, Array(outcomes).fill(1))
          .signers([oracle])
          .rpc();

        const resolvedQuestion = await vaultClient.fetchQuestion(question);
        assert.notEqual(
          resolvedQuestion.payoutDenominator.toString(),
          "0",
          "Question should be resolved",
        );

        const callbacks = expectError(
          "QuestionAlreadyResolved",
          "Vault initialized despite question being resolved",
        );

        await vaultClient
          .initializeVaultIx(question, underlyingTokenMint, outcomes)
          .rpc()
          .then(callbacks[0], callbacks[1]);
      });
    });
  });

  it("doesn't allow initializing vault for question with less than 2 outcomes", async function () {
    const oracle = Keypair.generate();
    const questionId = sha256(new Uint8Array([1, 2, 3]));
    const callbacks = expectError(
      "InsufficientNumConditions",
      "Vault initialized despite question having less than 2 outcomes",
    );

    await vaultClient
      .initializeQuestionIx(questionId, oracle.publicKey, 1)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("doesn't allow initializing vault for question with more than 10 outcomes", async function () {
    const oracle = Keypair.generate();
    const questionId = sha256(new Uint8Array([1, 2, 3]));
    const callbacks = expectError(
      "TooManyOutcomes",
      "Vault initialized despite question having more than 10 outcomes",
    );

    await vaultClient
      .initializeQuestionIx(questionId, oracle.publicKey, 11)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
