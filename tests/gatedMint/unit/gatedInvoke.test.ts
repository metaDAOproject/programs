import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import BN from "bn.js";
import {
  GATED_MINT_V0_1_PROGRAM_ID,
  GatedMintClient,
  MintGovernorClient,
  MAINNET_USDC,
  getGatedMintConfigAddr,
  getWhitelistedUserAddr,
} from "@metadaoproject/programs";
import {
  createMintWithFreezeAuthority,
  setupGatedMint,
  whitelistUser,
  freezeTokenAccount,
  getTokenAccountState,
  TOKEN_STATE_INITIALIZED,
  TOKEN_STATE_FROZEN,
} from "../utils.js";
import { initializeMintGovernorWithDefaults } from "../../mintGovernor/utils.js";
import { expectError } from "../../utils.js";
import { mintTo } from "spl-token-bankrun";

export default function suite() {
  let gatedMintClient: GatedMintClient;
  let mintGovernorClient: MintGovernorClient;
  let admin: Keypair;
  let alice: Keypair;
  let bob: Keypair;
  let mint: PublicKey;
  let aliceAta: PublicKey;
  let bobAta: PublicKey;

  before(async function () {
    gatedMintClient = this.gatedMint;
    mintGovernorClient = MintGovernorClient.createClient({
      provider: this.provider,
    });
  });

  beforeEach(async function () {
    admin = Keypair.generate();
    alice = Keypair.generate();
    bob = Keypair.generate();

    ({ mint } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      admin.publicKey,
    ));

    await whitelistUser(
      gatedMintClient,
      mint,
      admin,
      alice.publicKey,
      this.payer,
    );
    await whitelistUser(
      gatedMintClient,
      mint,
      admin,
      bob.publicKey,
      this.payer,
    );

    aliceAta = await this.createTokenAccount(mint, alice.publicKey);
    bobAta = await this.createTokenAccount(mint, bob.publicKey);

    await mintTo(
      this.banksClient,
      this.payer,
      mint,
      aliceAta,
      this.payer,
      100_000_000n,
    );

    await freezeTokenAccount(this.context, this.banksClient, aliceAta);
    await freezeTokenAccount(this.context, this.banksClient, bobAta);
  });

  it("transfers between whitelisted users with both ATAs frozen post-CPI", async function () {
    const transferIx = token.createTransferInstruction(
      aliceAta,
      bobAta,
      alice.publicKey,
      50_000_000n,
    );

    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint,
        instruction: transferIx,
      })
      .signers([alice])
      .rpc();

    const aliceBalance = await this.getTokenBalance(mint, alice.publicKey);
    const bobBalance = await this.getTokenBalance(mint, bob.publicKey);
    assert.equal(aliceBalance.toString(), "50000000");
    assert.equal(bobBalance.toString(), "50000000");

    assert.equal(
      await getTokenAccountState(this.banksClient, aliceAta),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, bobAta),
      TOKEN_STATE_FROZEN,
    );
  });

  it("freezes a freshly-created ATA after gated_invoke(mint_governor::mint_tokens)", async function () {
    const newMint = await createMintWithFreezeAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
    );

    const newAdmin = Keypair.generate();
    await gatedMintClient
      .initializeGatedMintIx({
        mint: newMint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: newAdmin.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    await whitelistUser(
      gatedMintClient,
      newMint,
      newAdmin,
      alice.publicKey,
      this.payer,
    );

    const { mintGovernor } = await initializeMintGovernorWithDefaults(
      this.banksClient,
      mintGovernorClient,
      this.payer,
      newMint,
    );

    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint: newMint,
        currentAuthority: this.payer.publicKey,
      })
      .rpc();

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: alice.publicKey,
        maxTotal: null,
      })
      .rpc();

    const recipientAta = token.getAssociatedTokenAddressSync(
      newMint,
      bob.publicKey,
    );
    const createAtaIx = token.createAssociatedTokenAccountIdempotentInstruction(
      this.payer.publicKey,
      recipientAta,
      bob.publicKey,
      newMint,
    );

    const mintTokensIx = await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint: newMint,
        destinationAta: recipientAta,
        authorizedMinter: alice.publicKey,
        amount: new BN(100_000_000),
      })
      .instruction();

    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint: newMint,
        instruction: mintTokensIx,
      })
      .preInstructions([createAtaIx])
      .signers([alice])
      .rpc();

    const balance = await this.getTokenBalance(newMint, bob.publicKey);
    assert.equal(balance.toString(), "100000000");

    assert.equal(
      await getTokenAccountState(this.banksClient, recipientAta),
      TOKEN_STATE_FROZEN,
    );
  });

  it("handles aliased duplicate accounts in remaining_accounts", async function () {
    const transferIx = token.createTransferInstruction(
      aliceAta,
      bobAta,
      alice.publicKey,
      50_000_000n,
    );

    const aliasedAccounts = [
      ...transferIx.keys,
      { pubkey: aliceAta, isSigner: false, isWritable: true },
    ];

    const [gatedMintConfig] = getGatedMintConfigAddr({ mint });
    const [whitelistedUser] = getWhitelistedUserAddr({
      mint,
      user: alice.publicKey,
    });

    await gatedMintClient.program.methods
      .gatedInvoke({ instructionData: transferIx.data })
      .accounts({
        caller: alice.publicKey,
        gatedMintConfig,
        whitelistedUser,
        mint,
        targetProgram: transferIx.programId,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(aliasedAccounts)
      .signers([alice])
      .rpc();

    assert.equal(
      await getTokenAccountState(this.banksClient, aliceAta),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, bobAta),
      TOKEN_STATE_FROZEN,
    );

    const aliceBalance = await this.getTokenBalance(mint, alice.publicKey);
    assert.equal(aliceBalance.toString(), "50000000");
  });

  it("does not touch non-gated-mint accounts in remaining_accounts", async function () {
    const usdcAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const usdcStateBefore = await getTokenAccountState(
      this.banksClient,
      usdcAta,
    );
    assert.equal(usdcStateBefore, TOKEN_STATE_INITIALIZED);

    const transferIx = token.createTransferInstruction(
      aliceAta,
      bobAta,
      alice.publicKey,
      50_000_000n,
    );

    const accountsWithUsdc = [
      ...transferIx.keys,
      { pubkey: usdcAta, isSigner: false, isWritable: false },
    ];

    const [gatedMintConfig] = getGatedMintConfigAddr({ mint });
    const [whitelistedUser] = getWhitelistedUserAddr({
      mint,
      user: alice.publicKey,
    });

    await gatedMintClient.program.methods
      .gatedInvoke({ instructionData: transferIx.data })
      .accounts({
        caller: alice.publicKey,
        gatedMintConfig,
        whitelistedUser,
        mint,
        targetProgram: transferIx.programId,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(accountsWithUsdc)
      .signers([alice])
      .rpc();

    const usdcStateAfter = await getTokenAccountState(
      this.banksClient,
      usdcAta,
    );
    assert.equal(usdcStateAfter, TOKEN_STATE_INITIALIZED);
  });

  it("fails when target_program is not in the whitelist", async function () {
    const transferIx = SystemProgram.transfer({
      fromPubkey: alice.publicKey,
      toPubkey: bob.publicKey,
      lamports: 1_000,
    });

    const callbacks = expectError(
      "TargetProgramNotWhitelisted",
      "Should have failed because system_program is not whitelisted",
    );

    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint,
        instruction: transferIx,
      })
      .signers([alice])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when caller is not whitelisted", async function () {
    const stranger = Keypair.generate();
    const strangerAta = await this.createTokenAccount(mint, stranger.publicKey);

    const transferIx = token.createTransferInstruction(
      strangerAta,
      bobAta,
      stranger.publicKey,
      0n,
    );

    try {
      await gatedMintClient
        .gatedInvokeIx({
          caller: stranger.publicKey,
          mint,
          instruction: transferIx,
        })
        .signers([stranger])
        .rpc();
      assert.fail("Should have failed because caller is not whitelisted");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails when caller is whitelisted for a different mint", async function () {
    const otherAdmin = Keypair.generate();
    const { mint: otherMint } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      otherAdmin.publicKey,
    );

    const transferIx = token.createTransferInstruction(
      aliceAta,
      bobAta,
      alice.publicKey,
      50_000_000n,
    );

    try {
      await gatedMintClient
        .gatedInvokeIx({
          caller: alice.publicKey,
          mint: otherMint,
          instruction: transferIx,
        })
        .signers([alice])
        .rpc();
      assert.fail(
        "Should have failed because caller is not whitelisted for this mint",
      );
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails when target_program == gated_mint::ID", async function () {
    const dummyIx = new TransactionInstruction({
      programId: GATED_MINT_V0_1_PROGRAM_ID,
      keys: [],
      data: Buffer.from([]),
    });

    const callbacks = expectError(
      "TargetProgramNotWhitelisted",
      "Should have failed because target is gated_mint::ID",
    );

    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint,
        instruction: dummyIx,
      })
      .signers([alice])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when gating is disabled", async function () {
    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const transferIx = token.createTransferInstruction(
      aliceAta,
      bobAta,
      alice.publicKey,
      50_000_000n,
    );

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is disabled",
    );

    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint,
        instruction: transferIx,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([alice])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
