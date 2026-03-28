import { ConditionalVaultClient, sha256 } from "@metadaoproject/futarchy-v2";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export default async function test() {
  // A scalar grant market test. Alice splits 100 USDC into E-UP and E-DOWN tokens.
  // She sends 30 E-UPs to Bob. The grant committee resolves the question with 60% effectiveness.
  // Alice and Bob redeem their tokens.

  const vaultClient: ConditionalVaultClient = this.vaultClient;

  const alice: Keypair = Keypair.generate();
  const bob: Keypair = Keypair.generate();
  const grantCommittee: Keypair = Keypair.generate();

  const question: PublicKey = await vaultClient.initializeQuestion(
    sha256(
      new TextEncoder().encode(
        "What is the effectiveness of the grant?/E-UP/E-DOWN",
      ),
    ),
    grantCommittee.publicKey,
    2,
  );

  const USDC: PublicKey = await this.createMint(this.payer.publicKey, 6);

  await this.createTokenAccount(USDC, alice.publicKey);
  await this.createTokenAccount(USDC, bob.publicKey);

  await this.mintTo(USDC, alice.publicKey, this.payer, 100);

  const vault = await vaultClient.initializeVault(question, USDC, 2);
  const storedVault = await vaultClient.fetchVault(vault);

  await vaultClient
    .splitTokensIx(question, vault, USDC, new BN(100), 2, alice.publicKey)
    .signers([alice])
    .rpc();

  const E_UP = storedVault.conditionalTokenMints[0];
  const E_DOWN = storedVault.conditionalTokenMints[1];

  await this.createTokenAccount(E_UP, bob.publicKey);

  await this.transfer(E_UP, alice, bob.publicKey, 30);

  // Grant committee resolves the question with 60% effectiveness
  await vaultClient.resolveQuestionIx(question, grantCommittee, [6, 4]).rpc();

  await vaultClient
    .redeemTokensIx(question, vault, USDC, 2, alice.publicKey)
    .signers([alice])
    .rpc();
  await vaultClient
    .redeemTokensIx(question, vault, USDC, 2, bob.publicKey)
    .signers([bob])
    .rpc();

  await this.assertBalance(USDC, bob.publicKey, 18);
  await this.assertBalance(USDC, alice.publicKey, 82);
}

// add tests for:
// - different numbers for outcomes (test 0)
// -
