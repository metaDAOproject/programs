import {
  sha256,
  ConditionalVaultClient,
  getQuestionAddr,
} from "@metadaoproject/futarchy";
// const { ConditionalVaultClient, getQuestionAddr } = futarchy;
import { Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";
// import { getQuestionAddr } from "@metadaoproject/futarchy/dist/v0.4";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  before(function () {
    vaultClient = this.conditionalVault;
  });

  it("initializes 2-outcome questions", async function () {
    const questionId = sha256(new Uint8Array([1, 2, 3]));

    const oracle = Keypair.generate();

    await vaultClient
      .initializeQuestionIx(questionId, oracle.publicKey, 2)
      .rpc();

    const [question] = getQuestionAddr(
      vaultClient.vaultProgram.programId,
      questionId,
      oracle.publicKey,
      2,
    );

    const storedQuestion = await vaultClient.fetchQuestion(question);
    assert.deepEqual(storedQuestion.questionId, Array.from(questionId));
    assert.ok(storedQuestion.oracle.equals(oracle.publicKey));
    assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
    assert.equal(storedQuestion.payoutDenominator, 0);
  });

  it("throws error when initializing a question with insufficient conditions", async function () {
    const callbacks = expectError(
      "InsufficientNumConditions",
      "question initialization succeeded despite insufficient conditions",
    );

    await vaultClient
      .initializeQuestionIx(
        sha256(new Uint8Array([4, 5, 6])),
        Keypair.generate().publicKey,
        1,
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
