import { sha256 } from "@metadaoproject/futarchy";
import { ConditionalVaultClient } from "@metadaoproject/futarchy/v0.5";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let question: PublicKey;
  let settlementAuthority: Keypair;

  before(function () {
    vaultClient = this.conditionalVault;
  });

  beforeEach(async function () {
    const questionId = sha256(new Uint8Array([4, 2, 1]));
    settlementAuthority = Keypair.generate();
    question = await vaultClient.initializeQuestion(
      questionId,
      settlementAuthority.publicKey,
      2
    );
  });

  it("resolves questions", async function () {
    let storedQuestion = await vaultClient.fetchQuestion(question);

    assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
    assert.equal(storedQuestion.payoutDenominator, 0);

    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [1, 0])
      .rpc();

    storedQuestion = await vaultClient.fetchQuestion(question);

    assert.deepEqual(storedQuestion.payoutNumerators, [1, 0]);
    assert.equal(storedQuestion.payoutDenominator, 1);
  });

  it("throws error when resolving a question with invalid number of payout numerators", async function () {
    const callbacks = expectError(
      "InvalidNumPayoutNumerators",
      "question resolution succeeded despite invalid number of payout numerators"
    );

    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [1, 0, 1])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when resolving a question with zero payout", async function () {
    const callbacks = expectError(
      "PayoutZero",
      "question resolution succeeded despite zero payout"
    );

    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [0, 0])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
