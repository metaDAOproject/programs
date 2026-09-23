import {
  ConditionalVaultClient,
  getVaultAddr,
  getConditionalTokenMintAddr,
  sha256,
} from "@metadaoproject/programs";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount, getMint } from "../../litesvm/index.js";
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
        const storedVaultUnderlyingAcc = await getAccount(
          this.banksClient,
          vaultUnderlyingTokenAccount,
        );
        assert.ok(storedVaultUnderlyingAcc.owner.equals(vault));
        assert.ok(storedVaultUnderlyingAcc.mint.equals(underlyingTokenMint));
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

  it("initializes the vault in a single instruction", async function () {
    const oracle = Keypair.generate();
    const question = await vaultClient.initializeQuestion(
      sha256(new Uint8Array([10, 11, 12])),
      oracle.publicKey,
      2,
    );

    const transaction = await vaultClient
      .initializeVaultIx(question, underlyingTokenMint, 2)
      .transaction();
    assert.lengthOf(transaction.instructions, 1);
  });

  it("uses a separately passed payer as the instruction's payer", async function () {
    const payer = Keypair.generate();
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    const oracle = Keypair.generate();
    const question = await vaultClient.initializeQuestion(
      sha256(new Uint8Array([13, 14, 15])),
      oracle.publicKey,
      2,
    );

    const instruction = await vaultClient
      .initializeVaultIx(question, underlyingTokenMint, 2, payer.publicKey)
      .instruction();
    const payerMeta = instruction.keys.find((meta) =>
      meta.pubkey.equals(payer.publicKey),
    );
    assert.isDefined(payerMeta);
    assert.isTrue(payerMeta.isSigner);
    assert.isTrue(payerMeta.isWritable);

    const balanceBefore = await this.banksClient.getBalance(payer.publicKey);
    await vaultClient
      .initializeVaultIx(question, underlyingTokenMint, 2, payer.publicKey)
      .signers([payer])
      .rpc();
    const balanceAfter = await this.banksClient.getBalance(payer.publicKey);
    assert.isTrue(balanceAfter < balanceBefore);
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
