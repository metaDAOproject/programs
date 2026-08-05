import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import {
  getMetadataAddr,
  MAINNET_USDC,
  RelaunchClient,
} from "@metadaoproject/programs";
import { BanksClient } from "solana-bankrun";
import { createLookupTableForTransaction } from "../../utils.js";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import {
  getPumpPoolAuthorityAddr,
  writePumpPool,
  PumpPool,
} from "../pumpAmm.js";

type InitializeRelaunchParams = Parameters<
  RelaunchClient["initializeRelaunchIx"]
>[0];

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

// TOKENS_TO_DEPOSITORS + TOKENS_TO_FUTARCHY_LIQUIDITY
const TOTAL_MINTED = 12_000_000n * 10n ** 6n;

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;
const MAX_SECONDS_FOR_DEPOSITS = 60 * 60 * 24 * 365;

async function createRawMint(
  banksClient: BanksClient,
  payer: Keypair,
  {
    decimals = 6,
    mintAuthority,
    freezeAuthority = null,
  }: {
    decimals?: number;
    mintAuthority: PublicKey;
    freezeAuthority?: PublicKey | null;
  },
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const rent = await banksClient.getRent();

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: Number(rent.minimumBalance(BigInt(token.MINT_SIZE))),
      space: token.MINT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);
  await banksClient.processTransaction(tx);

  return mintKeypair.publicKey;
}

// A pump-style Token-2022 mint: metadata pointer + mint-embedded token
// metadata, nothing else.
async function createT22MintWithMetadata(
  banksClient: BanksClient,
  payer: Keypair,
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const rent = await banksClient.getRent();
  const mintLen = token.getMintLen([token.ExtensionType.MetadataPointer]);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      // Overfund so the token metadata TLV realloc stays rent-exempt.
      lamports: Number(rent.minimumBalance(BigInt(mintLen + 500))),
      space: mintLen,
      programId: token.TOKEN_2022_PROGRAM_ID,
    }),
    token.createInitializeMetadataPointerInstruction(
      mint,
      payer.publicKey,
      mint,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    token.createInitializeMint2Instruction(
      mint,
      6,
      payer.publicKey,
      null,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    token.createInitializeInstruction({
      programId: token.TOKEN_2022_PROGRAM_ID,
      mint,
      metadata: mint,
      name: "Old Token",
      symbol: "OLD",
      uri: "https://example.com/old.json",
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
    }),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);
  await banksClient.processTransaction(tx);

  return mint;
}

async function createT22MintWithTransferFee(
  banksClient: BanksClient,
  payer: Keypair,
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const rent = await banksClient.getRent();
  const mintLen = token.getMintLen([token.ExtensionType.TransferFeeConfig]);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      lamports: Number(rent.minimumBalance(BigInt(mintLen))),
      space: mintLen,
      programId: token.TOKEN_2022_PROGRAM_ID,
    }),
    token.createInitializeTransferFeeConfigInstruction(
      mint,
      payer.publicKey,
      payer.publicKey,
      100,
      1_000_000n,
      token.TOKEN_2022_PROGRAM_ID,
    ),
    token.createInitializeMint2Instruction(
      mint,
      6,
      payer.publicKey,
      null,
      token.TOKEN_2022_PROGRAM_ID,
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);
  await banksClient.processTransaction(tx);

  return mint;
}

export default function suite() {
  let client: RelaunchClient;
  let oldMint: PublicKey;
  let oldTokenProgram: PublicKey;
  let pool: PumpPool;

  before(function () {
    client = this.relaunch;
  });

  beforeEach(async function () {
    ({ oldMint, oldTokenProgram } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    }));
    pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });
  });

  const defaultParams = function (this: Mocha.Context) {
    return {
      oldMint,
      oldTokenProgram,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: 1000,
      monthlySpendingLimitAmount: new BN(10_000_000_000), // 10k USDC
      monthlySpendingLimitMembers: [this.payer.publicKey],
      teamAddress: this.payer.publicKey,
    };
  };

  const initializeWithParams = async function (
    this: Mocha.Context,
    overrides: Partial<InitializeRelaunchParams> = {},
  ): Promise<PublicKey> {
    const { newMint, instructions } = await client.createNewMintIxs();
    await client
      .initializeRelaunchIx({
        newMint,
        ...defaultParams.call(this),
        ...overrides,
      })
      .preInstructions(instructions)
      .rpc();
    return newMint;
  };

  const expectInitializeToFail = async function (
    this: Mocha.Context,
    overrides: Partial<InitializeRelaunchParams>,
    expectedError: string,
  ) {
    try {
      await initializeWithParams.call(this, overrides);
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, expectedError);
    }
  };

  it("initializes a relaunch with valid parameters", async function () {
    const params = defaultParams.call(this);
    const { newMint, relaunch, txSignature } =
      await client.initializeRelaunch(params);
    assert.isString(txSignature);

    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const storedRelaunch = await client.fetchRelaunch(relaunch);

    assert.isTrue(storedRelaunch.admin.equals(this.payer.publicKey));
    assert.isTrue(storedRelaunch.newMint.equals(newMint));
    assert.isTrue(storedRelaunch.oldMint.equals(oldMint));
    assert.isTrue(storedRelaunch.sourcePool.equals(pool.pool));
    assert.isTrue(storedRelaunch.sourceQuoteMint.equals(token.NATIVE_MINT));
    assert.isTrue(storedRelaunch.relaunchSigner.equals(relaunchSigner));
    assert.isTrue(
      storedRelaunch.oldTokenVault.equals(
        token.getAssociatedTokenAddressSync(oldMint, relaunchSigner, true),
      ),
    );
    assert.isTrue(
      storedRelaunch.newTokenVault.equals(
        token.getAssociatedTokenAddressSync(newMint, relaunchSigner, true),
      ),
    );
    assert.isTrue(
      storedRelaunch.sourceQuoteVault.equals(
        token.getAssociatedTokenAddressSync(
          token.NATIVE_MINT,
          relaunchSigner,
          true,
        ),
      ),
    );
    assert.isTrue(
      storedRelaunch.usdcVault.equals(
        token.getAssociatedTokenAddressSync(MAINNET_USDC, relaunchSigner, true),
      ),
    );
    assert.equal(storedRelaunch.thresholdBps, params.thresholdBps);
    assert.equal(
      storedRelaunch.oldSupplySnapshot.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
    assert.equal(storedRelaunch.secondsForDeposits, params.secondsForDeposits);
    assert.equal(storedRelaunch.gracePeriodSeconds, params.gracePeriodSeconds);
    assert.equal(
      storedRelaunch.monthlySpendingLimitAmount.toString(),
      params.monthlySpendingLimitAmount.toString(),
    );
    assert.equal(storedRelaunch.monthlySpendingLimitMembers.length, 1);
    assert.isTrue(
      storedRelaunch.monthlySpendingLimitMembers[0].equals(
        this.payer.publicKey,
      ),
    );
    assert.isTrue(storedRelaunch.teamAddress.equals(this.payer.publicKey));
    assert.isDefined(storedRelaunch.state.initialized);
    assert.equal(storedRelaunch.totalDeposited.toString(), "0");
    assert.equal(storedRelaunch.quoteRecovered.toString(), "0");
    assert.equal(storedRelaunch.usdcRecovered.toString(), "0");
    assert.isNull(storedRelaunch.unixTimestampStarted);
    assert.isNull(storedRelaunch.unixTimestampClosed);
    assert.isNull(storedRelaunch.unixTimestampCompleted);
    assert.isNull(storedRelaunch.dao);
    assert.isNull(storedRelaunch.daoVault);
    assert.equal(storedRelaunch.seqNum.toString(), "0");

    const [expectedRelaunch, pdaBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("relaunch"), newMint.toBuffer()],
      client.getProgramId(),
    );
    assert.isTrue(relaunch.equals(expectedRelaunch));
    assert.equal(storedRelaunch.pdaBump, pdaBump);
    const [, signerBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("relaunch_signer"), relaunch.toBuffer()],
      client.getProgramId(),
    );
    assert.equal(storedRelaunch.relaunchSignerBump, signerBump);

    const rawNewMint = await this.banksClient.getAccount(newMint);
    const newMintState = token.unpackMint(newMint, {
      ...rawNewMint,
      data: Buffer.from(rawNewMint.data),
    } as any);
    assert.isTrue(newMintState.mintAuthority.equals(relaunchSigner));
    assert.equal(newMintState.supply.toString(), TOTAL_MINTED.toString());

    const rawVault = await this.banksClient.getAccount(
      storedRelaunch.newTokenVault,
    );
    const vault = token.unpackAccount(storedRelaunch.newTokenVault, {
      ...rawVault,
      data: Buffer.from(rawVault.data),
    } as any);
    assert.equal(vault.amount.toString(), TOTAL_MINTED.toString());

    const metadata = await this.banksClient.getAccount(
      getMetadataAddr(newMint)[0],
    );
    assert.isNotNull(metadata);
  });

  it("stores one shared vault for USDC-quoted sources", async function () {
    const usdcPool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: MAINNET_USDC,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: USDC_POOL_QUOTE_RESERVE,
    });

    const newMint = await initializeWithParams.call(this, {
      sourcePool: usdcPool.pool,
      sourceQuoteMint: MAINNET_USDC,
    });

    const relaunch = client.getRelaunchAddress({ newMint });
    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const storedRelaunch = await client.fetchRelaunch(relaunch);

    assert.isTrue(storedRelaunch.sourceQuoteMint.equals(MAINNET_USDC));
    assert.isTrue(
      storedRelaunch.sourceQuoteVault.equals(storedRelaunch.usdcVault),
    );
    assert.isTrue(
      storedRelaunch.usdcVault.equals(
        token.getAssociatedTokenAddressSync(MAINNET_USDC, relaunchSigner, true),
      ),
    );
  });

  it("initializes with a mint created in an earlier transaction", async function () {
    const { newMint, instructions } = await client.createNewMintIxs();

    const tx = new Transaction().add(...instructions);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);

    await client
      .initializeRelaunchIx({
        newMint,
        ...defaultParams.call(this),
      })
      .rpc();

    const storedRelaunch = await client.getRelaunch({ newMint });
    assert.isTrue(storedRelaunch.newMint.equals(newMint));
  });

  it("fails when the mint authority does not sign", async function () {
    const mintAuthority = Keypair.generate();
    const newMint = await createRawMint(this.banksClient, this.payer, {
      mintAuthority: mintAuthority.publicKey,
    });

    const ix = await client
      .initializeRelaunchIx({
        newMint,
        mintAuthority: mintAuthority.publicKey,
        ...defaultParams.call(this),
      })
      .instruction();
    for (const key of ix.keys) {
      if (key.pubkey.equals(mintAuthority.publicKey)) {
        key.isSigner = false;
      }
    }

    const tx = new Transaction().add(ix);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isNotNull(result.result);
    assert.isTrue(
      result.meta.logMessages.some((log) => log.includes("AccountNotSigner")),
    );
  });

  it("fails when the wrong key signs as mint authority", async function () {
    const newMint = await createRawMint(this.banksClient, this.payer, {
      mintAuthority: this.payer.publicKey,
    });
    const wrongAuthority = Keypair.generate();

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          mintAuthority: wrongAuthority.publicKey,
          ...defaultParams.call(this),
        })
        .signers([wrongAuthority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintMintMintAuthority");
    }
  });

  it("fails when the mint is pre-pointed at the relaunch signer", async function () {
    const { newMint, instructions } = await client.createNewMintIxs();
    const relaunch = client.getRelaunchAddress({ newMint });
    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });

    // Recreate launchpad's convention: mint born with authority already set
    // to the program PDA. A PDA can't sign, so this mint is uninitializable.
    const createAccountIx = instructions[0];
    const tx = new Transaction().add(
      createAccountIx,
      token.createInitializeMint2Instruction(newMint, 6, relaunchSigner, null),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          ...defaultParams.call(this),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintMintMintAuthority");
    }
  });

  it("fails when the new mint has non-zero supply", async function () {
    const newMint = await createRawMint(this.banksClient, this.payer, {
      mintAuthority: this.payer.publicKey,
    });

    const ata = token.getAssociatedTokenAddressSync(
      newMint,
      this.payer.publicKey,
    );
    const tx = new Transaction().add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        ata,
        this.payer.publicKey,
        newMint,
      ),
      token.createMintToInstruction(
        newMint,
        ata,
        this.payer.publicKey,
        100_000_000,
      ),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          ...defaultParams.call(this),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "SupplyNonZero");
    }
  });

  it("fails when the new mint has a freeze authority", async function () {
    const newMint = await createRawMint(this.banksClient, this.payer, {
      mintAuthority: this.payer.publicKey,
      freezeAuthority: this.payer.publicKey,
    });

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          ...defaultParams.call(this),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "FreezeAuthoritySet");
    }
  });

  it("fails when the new mint has wrong decimals", async function () {
    const newMint = await createRawMint(this.banksClient, this.payer, {
      decimals: 9,
      mintAuthority: this.payer.publicKey,
    });

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          ...defaultParams.call(this),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintMintDecimals");
    }
  });

  it("initializes with a Token-2022 old mint carrying only metadata extensions", async function () {
    const oldMint22 = await createT22MintWithMetadata(
      this.banksClient,
      this.payer,
    );
    const pool22 = await writePumpPool({
      context: this.context,
      baseMint: oldMint22,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    });

    const newMint = await initializeWithParams.call(this, {
      oldMint: oldMint22,
      oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      sourcePool: pool22.pool,
    });

    const relaunch = client.getRelaunchAddress({ newMint });
    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const storedRelaunch = await client.fetchRelaunch(relaunch);

    assert.isTrue(storedRelaunch.oldMint.equals(oldMint22));
    assert.isTrue(
      storedRelaunch.oldTokenVault.equals(
        token.getAssociatedTokenAddressSync(
          oldMint22,
          relaunchSigner,
          true,
          token.TOKEN_2022_PROGRAM_ID,
        ),
      ),
    );
    assert.equal(storedRelaunch.oldSupplySnapshot.toString(), "0");
  });

  it("fails closed on a Token-2022 old mint with a transfer-fee extension", async function () {
    const oldMint22 = await createT22MintWithTransferFee(
      this.banksClient,
      this.payer,
    );
    const pool22 = await writePumpPool({
      context: this.context,
      baseMint: oldMint22,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    });

    await expectInitializeToFail.call(
      this,
      {
        oldMint: oldMint22,
        oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
        sourcePool: pool22.pool,
      },
      "ForbiddenOldMintExtension",
    );
  });

  it("fails when the source pool is not owned by pump_amm", async function () {
    const foreignPool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      owner: token.TOKEN_PROGRAM_ID,
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: foreignPool.pool },
      "SourcePoolNotCanonical",
    );
  });

  it("fails when the source pool index is not 0", async function () {
    const indexedPool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      index: 1,
      creator: getPumpPoolAuthorityAddr(oldMint),
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: indexedPool.pool },
      "SourcePoolNotCanonical",
    );
  });

  it("fails when the source pool has a different base mint", async function () {
    const otherMint = Keypair.generate().publicKey;
    const otherPool = await writePumpPool({
      context: this.context,
      baseMint: otherMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: otherPool.pool },
      "SourcePoolNotCanonical",
    );
  });

  it("fails when the source pool creator is not the pool-authority PDA", async function () {
    const squattedPool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      creator: Keypair.generate().publicKey,
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: squattedPool.pool },
      "SourcePoolNotCanonical",
    );
  });

  it("fails when a canonical-looking pool sits at the wrong address", async function () {
    // A byte-for-byte copy of the canonical pool at a different address
    // passes every field check — only the derived-address check catches it.
    const impostor = Keypair.generate().publicKey;
    const canonicalPool = await this.banksClient.getAccount(pool.pool);
    this.context.setAccount(impostor, {
      data: Buffer.from(canonicalPool.data),
      owner: canonicalPool.owner,
      lamports: Number(canonicalPool.lamports),
      executable: false,
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: impostor },
      "SourcePoolNotCanonical",
    );
  });

  it("fails when the quote mint is neither WSOL nor USDC", async function () {
    const bogusQuoteMint = await createRawMint(this.banksClient, this.payer, {
      mintAuthority: this.payer.publicKey,
    });
    const bogusPool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: bogusQuoteMint,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: USDC_POOL_QUOTE_RESERVE,
    });

    await expectInitializeToFail.call(
      this,
      { sourcePool: bogusPool.pool, sourceQuoteMint: bogusQuoteMint },
      "InvalidQuoteMint",
    );
  });

  it("fails when the quote mint does not match the source pool's quote mint", async function () {
    await expectInitializeToFail.call(
      this,
      { sourceQuoteMint: MAINNET_USDC },
      "SourcePoolQuoteMintMismatch",
    );
  });

  it("validates the threshold bounds", async function () {
    await expectInitializeToFail.call(
      this,
      { thresholdBps: 0 },
      "InvalidThresholdBps",
    );
    await expectInitializeToFail.call(
      this,
      { thresholdBps: 10_001 },
      "InvalidThresholdBps",
    );

    const newMint = await initializeWithParams.call(this, {
      thresholdBps: 10_000,
    });
    const storedRelaunch = await client.getRelaunch({ newMint });
    assert.equal(storedRelaunch.thresholdBps, 10_000);
  });

  it("fails when the deposit period exceeds the cap", async function () {
    await expectInitializeToFail.call(
      this,
      { secondsForDeposits: MAX_SECONDS_FOR_DEPOSITS + 1 },
      "InvalidSecondsForDeposits",
    );
  });

  it("initializes without a spending limit", async function () {
    const newMint = await initializeWithParams.call(this, {
      monthlySpendingLimitAmount: new BN(0),
      monthlySpendingLimitMembers: [],
    });

    const storedRelaunch = await client.getRelaunch({ newMint });
    assert.equal(storedRelaunch.monthlySpendingLimitAmount.toString(), "0");
    assert.equal(storedRelaunch.monthlySpendingLimitMembers.length, 0);
  });

  it("validates the spending limit config", async function () {
    // A half-set config fails in either direction: an amount nobody can
    // spend, or members with nothing to spend.
    await expectInitializeToFail.call(
      this,
      { monthlySpendingLimitAmount: new BN(0) },
      "InvalidMonthlySpendingLimit",
    );
    await expectInitializeToFail.call(
      this,
      { monthlySpendingLimitMembers: [] },
      "InvalidMonthlySpendingLimit",
    );
    await expectInitializeToFail.call(
      this,
      {
        monthlySpendingLimitMembers: [
          this.payer.publicKey,
          this.payer.publicKey,
        ],
      },
      "InvalidMonthlySpendingLimitMembers",
    );
    // 11 member pubkeys push the transaction past the packet size limit, so
    // this one goes through a v0 transaction with a lookup table.
    const { newMint, instructions } = await client.createNewMintIxs();
    const initTx = await client
      .initializeRelaunchIx({
        newMint,
        ...defaultParams.call(this),
        monthlySpendingLimitMembers: Array.from(
          { length: 11 },
          () => Keypair.generate().publicKey,
        ),
      })
      .preInstructions(instructions)
      .transaction();

    const lookupTable = await createLookupTableForTransaction(initTx, this);
    const message = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: initTx.instructions,
    }).compileToV0Message([lookupTable]);
    const tx = new VersionedTransaction(message);
    tx.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isNotNull(result.result);
    assert.isTrue(
      result.meta.logMessages.some((log) =>
        log.includes("InvalidMonthlySpendingLimitMembers"),
      ),
    );
  });

  it("fails to initialize the same new mint twice", async function () {
    const { newMint, instructions } = await client.createNewMintIxs();
    await client
      .initializeRelaunchIx({
        newMint,
        ...defaultParams.call(this),
      })
      .preInstructions(instructions)
      .rpc();

    try {
      await client
        .initializeRelaunchIx({
          newMint,
          ...defaultParams.call(this),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      const details = [e.message, ...(e.logs ?? [])].join(" ");
      assert.include(details, "already in use");
    }
  });

  it("allows a rival relaunch for the same old mint under a different new mint", async function () {
    const firstNewMint = await initializeWithParams.call(this);
    const secondNewMint = await initializeWithParams.call(this);

    const first = await client.getRelaunch({ newMint: firstNewMint });
    const second = await client.getRelaunch({ newMint: secondNewMint });

    assert.isTrue(first.oldMint.equals(oldMint));
    assert.isTrue(second.oldMint.equals(oldMint));
    assert.isTrue(first.sourcePool.equals(second.sourcePool));
    assert.isFalse(first.relaunchSigner.equals(second.relaunchSigner));
    assert.isFalse(first.oldTokenVault.equals(second.oldTokenVault));
  });
}
