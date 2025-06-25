import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  getMetadataAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.5";
import { createMint, mintTo } from "spl-token-bankrun";
import { BN } from "bn.js";
import {
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as token from "@solana/spl-token";
import {
  MAINNET_USDC,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.5";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  before(async function () {
    autocratClient = this.autocratClient;
    launchpadClient = this.launchpadClient;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpadClient,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
  });

  it("initializes a launch with valid parameters", async function () {
    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week

    const [, pdaBump] = getLaunchAddr(launchpadClient.getProgramId(), META);
    const [, launchSignerPdaBump] = getLaunchSignerAddr(
      launchpadClient.getProgramId(),
      launch
    );

    await launchpadClient
      .initializeLaunchIx(
        "META",
        "META",
        "https://example.com",
        minRaise,
        secondsForLaunch,
        META,
        MAINNET_USDC
      )
      .rpc();

    const storedLaunch = await launchpadClient.fetchLaunch(launch);

    assert.equal(
      storedLaunch.minimumRaiseAmount.toString(),
      minRaise.toString()
    );
    assert.ok(storedLaunch.launchAuthority.equals(this.payer.publicKey));
    assert.ok(storedLaunch.launchSigner.equals(launchSigner));
    assert.equal(storedLaunch.launchSignerPdaBump, launchSignerPdaBump);
    assert.ok(
      storedLaunch.launchQuoteVault.equals(
        token.getAssociatedTokenAddressSync(MAINNET_USDC, launchSigner, true)
      )
    );
    assert.ok(
      storedLaunch.launchBaseVault.equals(
        token.getAssociatedTokenAddressSync(META, launchSigner, true)
      )
    );
    assert.ok(storedLaunch.baseMint.equals(META));
    assert.equal(storedLaunch.pdaBump, pdaBump);
    assert.equal(storedLaunch.totalCommittedAmount.toString(), "0");
    assert.equal(storedLaunch.seqNum.toString(), "0");
    assert.exists(storedLaunch.state.initialized);
    assert.equal(storedLaunch.unixTimestampStarted.toString(), "0");
    assert.equal(storedLaunch.dao, null);
    assert.equal(storedLaunch.daoTreasury, null);
  });

  it("fails when launch signer is faked", async function () {
    const minimumRaiseAmount = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const fakeLaunchSigner = Keypair.generate();

    META = await PublicKey.createWithSeed(
      this.payer.publicKey,
      "fake-launch-signer",
      token.TOKEN_PROGRAM_ID
    );

    const rent = await this.banksClient.getRent();

    const lamports = Number(await rent.minimumBalance(BigInt(token.MINT_SIZE)));

    const tx = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: META,
        basePubkey: this.payer.publicKey,
        seed: "fake-launch-signer",
        lamports: lamports,
        space: token.MINT_SIZE,
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(
        META,
        6,
        fakeLaunchSigner.publicKey,
        null
      )
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    await this.banksClient.processTransaction(tx);

    const [tokenMetadata] = getMetadataAddr(META);

    try {
      await launchpadClient.launchpad.methods
        .initializeLaunch({
          tokenName: "MetaDAO",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount,
          secondsForLaunch,
        })
        .accounts({
          launch,
          launchSigner: fakeLaunchSigner.publicKey,
          quoteVault: token.getAssociatedTokenAddressSync(
            MAINNET_USDC,
            fakeLaunchSigner.publicKey,
            true
          ),
          baseVault: token.getAssociatedTokenAddressSync(
            META,
            fakeLaunchSigner.publicKey,
            true
          ),
          launchAuthority: this.payer.publicKey,
          quoteMint: MAINNET_USDC,
          baseMint: META,
          tokenMetadata,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        })
        .preInstructions([
          token.createAssociatedTokenAccountIdempotentInstruction(
            this.payer.publicKey,
            getAssociatedTokenAddressSync(
              MAINNET_USDC,
              fakeLaunchSigner.publicKey,
              true
            ),
            fakeLaunchSigner.publicKey,
            MAINNET_USDC
          ),
        ])
        .remainingAccounts([
          {
            pubkey: fakeLaunchSigner.publicKey,
            isWritable: false,
            isSigner: true,
          },
        ])
        .signers([fakeLaunchSigner])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintSeeds");
    }
  });
}
