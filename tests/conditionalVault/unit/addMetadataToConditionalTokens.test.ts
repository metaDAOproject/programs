import {
  sha256,
  ConditionalVaultClient,
  getConditionalTokenMintAddr,
  getMetadataAddr,
} from "@metadaoproject/programs";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint } from "spl-token-bankrun";
import { expectError } from "../../utils.js";
import { getMetadataAccountDataSerializer } from "@metaplex-foundation/mpl-token-metadata";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let question: PublicKey;
  let vault: PublicKey;
  let underlyingTokenMint: PublicKey;

  const metadataSerializer = getMetadataAccountDataSerializer();

  before(function () {
    vaultClient = this.conditionalVault;
  });

  async function setupVault(outcomes: number) {
    const questionId = sha256(new Uint8Array([1, 2, 3]));
    const oracle = Keypair.generate();

    question = await vaultClient.initializeQuestion(
      questionId,
      oracle.publicKey,
      outcomes,
    );

    underlyingTokenMint = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      null,
      8,
    );

    vault = await vaultClient.initializeVault(
      question,
      underlyingTokenMint,
      outcomes,
    );
  }

  async function addMetadataToConditionalTokens(outcomes: number) {
    for (let i = 0; i < outcomes; i++) {
      await vaultClient
        .addMetadataToConditionalTokensIx(
          vault,
          i,
          `Outcome ${i}`,
          `OUT${i}`,
          `https://example.com/uri${i}.png`,
        )
        .rpc();
    }
  }

  async function verifyMetadata(outcomes: number) {
    for (let i = 0; i < outcomes; i++) {
      const [conditionalTokenMint] = getConditionalTokenMintAddr(
        vaultClient.vaultProgram.programId,
        vault,
        i,
      );

      const storedMetadata = await this.banksClient.getAccount(
        getMetadataAddr(conditionalTokenMint)[0],
      );
      assert.isNotNull(storedMetadata);
      const metadata = metadataSerializer.deserialize(storedMetadata.data)[0];
      assert.equal(metadata.name, `Outcome ${i}`);
      assert.equal(metadata.symbol, `OUT${i}`);
      assert.equal(metadata.uri, `https://example.com/uri${i}.png`);
    }
  }

  it("adds metadata to 2-token vault", async function () {
    await setupVault.call(this, 2);
    await addMetadataToConditionalTokens(2);
    await verifyMetadata.call(this, 2);
  });

  it("adds metadata to 3-token vault", async function () {
    await setupVault.call(this, 3);
    await addMetadataToConditionalTokens(3);
    await verifyMetadata.call(this, 3);
  });

  it("adds metadata to 10-token vault", async function () {
    await setupVault.call(this, 10);
    await addMetadataToConditionalTokens(10);
    await verifyMetadata.call(this, 10);
  });

  it("cannot add metadata twice for the same conditional token", async function () {
    await setupVault.call(this, 2);
    await addMetadataToConditionalTokens(2);

    const callbacks = expectError(
      "ConditionalTokenMetadataAlreadySet",
      "added metadata to a conditional token that already had metadata",
    );

    await vaultClient
      .addMetadataToConditionalTokensIx(
        vault,
        0,
        "New Outcome",
        "NEW",
        "https://example.com/new.png",
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
