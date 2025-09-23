import { ConditionalVaultClient } from "@metadaoproject/futarchy/v0.6";
import { sha256 } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export default function suite() {
  it("binary prediction market", async function () {
    // A binary prediction market test. Alice, Bob, and Charlie are betting on
    // who's going to win the next election: Trump or Harris. Alice and Bob each
    // split 100 USDC into TRUMP and HARRIS tokens. Alice is a trump supporter
    // and buys 30 TRUMP tokens in exchange for 40 HARRIS tokens from Bob. Charlie
    // buys an additional 30 HARRIS tokens from Alice.

    // Alice should have 130 TRUMP and 30 HARRIS tokens. Bob should have 70 TRUMP
    // and 140 HARRIS tokens. Charlie should have 30 HARRIS tokens.

    // Alice faces a cash crunch, and merges 20 TRUMP and 20 HARRIS tokens into 20
    // USDC. She should now have 20 USDC, 110 TRUMP, and 10 HARRIS tokens.

    // Bob becomes a trump supporter, and as a display of his newfound
    // allegiance, he sends all of his HARRIS tokens to the vault (to burn them).
    // Bob should now have 70 TRUMP tokens.

    // The market resolves in favor of Harris. When redeeming, Alice should get 15
    // USDC, Bob should get nothing, and Charlie should get 30 USDC.

    const vaultClient: ConditionalVaultClient = this.conditionalVault;

    const alice: Keypair = Keypair.generate();
    const bob: Keypair = Keypair.generate();
    const charlie: Keypair = Keypair.generate();
    const operator: Keypair = Keypair.generate();

    const question: PublicKey = await vaultClient.initializeQuestion(
      sha256(
        new TextEncoder().encode(
          "Who's going to win the next election?/TRUMP/HARRIS",
        ),
      ),
      operator.publicKey,
      2,
    );

    const USDC: PublicKey = await this.createMint(operator.publicKey, 6);

    await this.createTokenAccount(USDC, alice.publicKey);
    await this.createTokenAccount(USDC, bob.publicKey);
    await this.createTokenAccount(USDC, charlie.publicKey);

    await this.mintTo(USDC, alice.publicKey, operator, 100);
    await this.mintTo(USDC, bob.publicKey, operator, 100);

    const vault = await vaultClient.initializeVault(question, USDC, 2);
    const storedVault = await vaultClient.fetchVault(vault);

    await vaultClient
      .addMetadataToConditionalTokensIx(
        vault,
        0,
        "Trump Share",
        "TRUMP",
        "https://example.com/trump.png",
      )
      .rpc();
    await vaultClient
      .addMetadataToConditionalTokensIx(
        vault,
        1,
        "Harris Share",
        "HARRIS",
        "https://example.com/harris.png",
      )
      .rpc();

    await vaultClient
      .splitTokensIx(question, vault, USDC, new BN(100), 2, alice.publicKey)
      .signers([alice])
      .rpc();

    await vaultClient
      .splitTokensIx(question, vault, USDC, new BN(100), 2, bob.publicKey)
      .signers([bob])
      .rpc();

    const TRUMP = storedVault.conditionalTokenMints[0];
    const HARRIS = storedVault.conditionalTokenMints[1];

    await this.createTokenAccount(HARRIS, charlie.publicKey);

    await this.transfer(HARRIS, alice, bob.publicKey, 40);
    await this.transfer(TRUMP, bob, alice.publicKey, 30);
    await this.transfer(HARRIS, alice, charlie.publicKey, 30);

    await vaultClient
      .mergeTokensIx(question, vault, USDC, new BN(20), 2, alice.publicKey)
      .signers([alice])
      .rpc();

    await this.assertBalance(USDC, alice.publicKey, 20);
    await this.assertBalance(TRUMP, alice.publicKey, 110);
    await this.assertBalance(HARRIS, alice.publicKey, 10);

    await this.createTokenAccount(HARRIS, vault);
    await this.transfer(HARRIS, bob, vault, 140);

    await vaultClient.resolveQuestionIx(question, operator, [0, 1]).rpc();

    await vaultClient
      .redeemTokensIx(question, vault, USDC, 2, alice.publicKey)
      .signers([alice])
      .rpc();
    await vaultClient
      .redeemTokensIx(question, vault, USDC, 2, bob.publicKey)
      .signers([bob])
      .rpc();
    await vaultClient
      .redeemTokensIx(question, vault, USDC, 2, charlie.publicKey)
      .signers([charlie])
      .rpc();

    await this.assertBalance(USDC, alice.publicKey, 30);
    await this.assertBalance(USDC, bob.publicKey, 0);
    await this.assertBalance(USDC, charlie.publicKey, 30);
  });
}
