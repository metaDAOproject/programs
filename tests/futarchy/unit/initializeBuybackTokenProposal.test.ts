import {
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  FUTARCHY_V0_6_PROGRAM_ID,
  SQUADS_PROGRAM_ID,
  getEventAuthorityAddr,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  assertVaultTransactionPayload,
  executeVaultTransaction,
  expectError,
  passProposal,
  setupBasicDao,
} from "../../utils.js";
import { TestContext } from "../../main.test.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

const sortKeys = (keys: PublicKey[]) =>
  [...keys].sort((a, b) => a.toBuffer().compare(b.toBuffer()));

// The vault can't sign a transfer in tests, and only the balance matters to
// the cap, so "draining the treasury" overwrites the token amount in place
// (u64 LE at offset 64, after mint and owner).
async function setTokenAccountAmount(
  context: TestContext,
  tokenAccount: PublicKey,
  amount: bigint,
) {
  const raw = await context.banksClient.getAccount(tokenAccount);
  const data = Buffer.from(raw.data);
  data.writeBigUInt64LE(amount, 64);
  context.context.setAccount(tokenAccount, { ...raw, data });
}

// Fails the live proposal: one swap after the TWAP start delay records an
// observation in both markets, and the equal TWAPs it leaves can't clear the
// +10% threshold.
async function failProposal(
  context: TestContext,
  {
    dao,
    proposal,
    baseMint,
    quoteMint,
  }: {
    dao: PublicKey;
    proposal: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  },
) {
  await context.advanceBySeconds(60 * 60 * 24 + 60);
  await context.futarchy
    .spotSwapIx({
      dao,
      baseMint,
      quoteMint,
      swapType: "buy",
      inputAmount: new BN(1_000),
    })
    .rpc();

  await context.advanceBySeconds(60 * 60 * 24 * 10);
  await context.futarchy.finalizeProposal(proposal);

  const storedProposal = await context.futarchy.getProposal(proposal);
  assert.exists(storedProposal.state.failed);
}

async function adminCancel(
  context: TestContext,
  { dao, proposal }: { dao: PublicKey; proposal: PublicKey },
) {
  const storedProposal = await context.futarchy.getProposal(proposal);
  const storedDao = await context.futarchy.getDao(dao);

  const {
    question,
    baseVault,
    quoteVault,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
  } = context.futarchy.getProposalPdas(
    proposal,
    storedDao.baseMint,
    storedDao.quoteMint,
    dao,
  );

  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  const [vaultEventAuthority] = getEventAuthorityAddr(
    CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  );

  await context.futarchy.futarchy.methods
    .adminCancelProposal()
    .accounts({
      proposal,
      dao,
      question,
      squadsProposal: storedProposal.squadsProposal,
      squadsMultisig: multisigPda,
      squadsMultisigProgram: SQUADS_PROGRAM_ID,
      admin: context.payer.publicKey,
      ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, dao, true),
      ammPassQuoteVault: getAssociatedTokenAddressSync(
        passQuoteMint,
        dao,
        true,
      ),
      ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, dao, true),
      ammFailQuoteVault: getAssociatedTokenAddressSync(
        failQuoteMint,
        dao,
        true,
      ),
      ammBaseVault: getAssociatedTokenAddressSync(
        storedDao.baseMint,
        dao,
        true,
      ),
      ammQuoteVault: getAssociatedTokenAddressSync(
        storedDao.quoteMint,
        dao,
        true,
      ),
      vaultProgram: CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
      vaultEventAuthority,
      quoteVault,
      quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
        storedDao.quoteMint,
        quoteVault,
        true,
      ),
      passQuoteMint,
      failQuoteMint,
      passBaseMint,
      failBaseMint,
      baseVault,
      baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
        storedDao.baseMint,
        baseVault,
        true,
      ),
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .signers([context.payer])
    .rpc();
}

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    vault: PublicKey,
    vaultQuoteAccount: PublicKey,
    vaultPosition: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      1_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const storedDao = await this.futarchy.getDao(dao);
    vault = storedDao.squadsMultisigVault;
    vaultQuoteAccount = getAssociatedTokenAddressSync(USDC, vault, true);
    [vaultPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
  });

  it("bakes exactly one program-built memo as the whole payload", async function () {
    // The worked example: 400,000 USDC, 5,000 a day for 80 days, unguarded.
    // Create never consults the treasury, so no funding is needed here.
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    const expectedMemoIx = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(
        `metadao-buyback/1 proposal=${proposal.toBase58()} spend=400000000000 cycles=80 cycle_seconds=86400 start_delay=0 min_price=none max_price=none`,
        "utf8",
      ),
    });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedMemoIx,
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isNull(storedProposal.sponsoredBy);
  });

  it("formats a banded mandate's prices into the memo", async function () {
    const { proposal, squadsTransaction } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 3_600,
        startDelaySeconds: 60,
        minPrice: new BN(1_600_000),
        maxPrice: new BN(2_000_000),
      });

    const expectedMemoIx = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(
        `metadao-buyback/1 proposal=${proposal.toBase58()} spend=400000000 cycles=80 cycle_seconds=3600 start_delay=60 min_price=1600000 max_price=2000000`,
        "utf8",
      ),
    });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedMemoIx,
    ]);
  });

  it("snapshots the kind's catalog row and args at create", async function () {
    const { proposal } = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 3_600,
      minPrice: new BN(1_600_000),
      maxPrice: new BN(2_000_000),
    });

    const storedProposal = await this.futarchy.getProposal(proposal);

    // 10 days, +10%, blockable
    assert.equal(storedProposal.durationInSeconds, 864_000);
    assert.equal(storedProposal.passThresholdBps, 1000);
    assert.isTrue(storedProposal.councilCanBlock);

    const action = storedProposal.action.buybackToken;
    assert.equal(action.quoteAmount.toString(), "400000000");
    assert.equal(action.cycleCount, 80);
    assert.equal(action.cycleFrequencySeconds, 86_400);
    assert.equal(action.startDelaySeconds, 3_600);
    assert.equal(action.minPrice.toString(), "1600000");
    assert.equal(action.maxPrice.toString(), "2000000");

    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.proposalCount, 1);
  });

  it("launches with the amount at exactly 25% of the treasury", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000), // 400 tokens = 25% of 1,600
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("rejects an amount one unit above 25% of the treasury", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_001),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    const callbacks = expectError(
      "BuybackCapExceeded",
      "launched a buyback one unit above the cap",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("counts the treasury's AMM position, and omission only shrinks the cap", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_000 * 1_000_000);

    // The treasury's own LP position, worth ~1,000 USDC in quote
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // 300 * 4 = 1,200: above the vault account alone, within the treasury
    // once the position's quote share counts
    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(300_000_000),
        cycleCount: 60,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    const launchWith = (treasuryAccounts: PublicKey[]) =>
      this.futarchy
        .launchProposalIx({
          proposal,
          dao,
          baseMint: META,
          quoteMint: USDC,
          squadsProposal,
          treasuryAccounts,
        })
        .rpc();

    const emptyCallbacks = expectError(
      "BuybackCapExceeded",
      "launched against an empty treasury list",
    );
    await launchWith([]).then(emptyCallbacks[0], emptyCallbacks[1]);

    const partialCallbacks = expectError(
      "BuybackCapExceeded",
      "launched with the position omitted from the treasury list",
    );
    await launchWith([vaultQuoteAccount]).then(
      partialCallbacks[0],
      partialCallbacks[1],
    );

    await launchWith(sortKeys([vaultQuoteAccount, vaultPosition]));

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("values the position at the pool's observation, so pumping the quote reserves can't lift the cap", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_000 * 1_000_000);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // 600 * 4 = 2,400 against a 2,000 treasury
    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(600_000_000),
        cycleCount: 120,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(50_000 * 1_000_000),
      })
      .rpc();

    // The pump lifts the position's reserve-based quote share past the cap;
    // only valuing it at the observation keeps the launch out.
    const storedDao = await this.futarchy.getDao(dao);
    const spot = storedDao.amm.state.spot.spot;
    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(vaultPosition);
    const reserveBasedTreasury = position.liquidity
      .mul(spot.quoteReserves)
      .div(storedDao.amm.totalLiquidity)
      .add(new BN(1_000 * 1_000_000));
    assert.isTrue(reserveBasedTreasury.gte(new BN(2_400_000_000)));

    const callbacks = expectError(
      "BuybackCapExceeded",
      "launched a buyback against pumped quote reserves",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("takes the lower of the reserve and observation figures, so dumping into the pool can't lift it either", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_000 * 1_000_000);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(600_000_000),
        cycleCount: 120,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "sell",
        inputAmount: new BN(45 * 1_000_000),
      })
      .rpc();

    // The dump lifts the position's observation-priced base share past the
    // cap while its quote share falls; the lower figure is the one that counts.
    const storedDao = await this.futarchy.getDao(dao);
    const spot = storedDao.amm.state.spot.spot;
    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(vaultPosition);
    const observationBasedTreasury = position.liquidity
      .mul(spot.baseReserves)
      .mul(spot.oracle.lastObservation)
      .div(new BN(10).pow(new BN(12)))
      .div(storedDao.amm.totalLiquidity)
      .add(new BN(1_000 * 1_000_000));
    assert.isTrue(observationBasedTreasury.gte(new BN(2_400_000_000)));

    const callbacks = expectError(
      "BuybackCapExceeded",
      "launched a buyback against dumped base reserves",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("binds the cap to the launch-time balance, not create's", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    await setTokenAccountAmount(this, vaultQuoteAccount, 1_599_999_999n);

    const callbacks = expectError(
      "BuybackCapExceeded",
      "launched against a drained treasury",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects hand-built adversarial treasury lists, each by its own check", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    // The treasury's real position, so the unsorted case can use two
    // individually valid accounts
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // A real position of a foreign DAO's treasury
    const foreignDao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });
    const foreignVault = (await this.futarchy.getDao(foreignDao))
      .squadsMultisigVault;
    await this.futarchy
      .provideLiquidityIx({
        dao: foreignDao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: foreignVault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_001 }),
      ])
      .rpc();
    const [foreignPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        foreignDao.toBuffer(),
        foreignVault.toBuffer(),
      ],
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    // An account with the position's exact discriminator and fields, planted
    // at a non-PDA address — only the derived address check can catch it
    const forgedPosition = Keypair.generate().publicKey;
    const forgedData = await this.futarchy.futarchy.coder.accounts.encode(
      "ammPosition",
      {
        dao,
        positionAuthority: vault,
        liquidity: new BN(1_000_000_000),
      },
    );
    this.context.setAccount(forgedPosition, {
      lamports: 10_000_000,
      data: forgedData,
      owner: FUTARCHY_V0_6_PROGRAM_ID,
      executable: false,
    });

    // The payer's own position: right account type, wrong authority (and so
    // the wrong PDA)
    const [payerPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    const payerQuoteAccount = getAssociatedTokenAddressSync(
      USDC,
      this.payer.publicKey,
      true,
    );
    const vaultBaseAccount = await this.createTokenAccount(META, vault);

    const { proposal, squadsProposal } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(10_000_000), // comfortably under the cap
        cycleCount: 2,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    const launchWith = (treasuryAccounts: PublicKey[]) =>
      this.futarchy
        .launchProposalIx({
          proposal,
          dao,
          baseMint: META,
          quoteMint: USDC,
          squadsProposal,
          treasuryAccounts,
        })
        .rpc();

    const rejects = async (
      treasuryAccounts: PublicKey[],
      expectedError: string,
      message: string,
    ) => {
      const callbacks = expectError(expectedError, message);
      await launchWith(treasuryAccounts).then(callbacks[0], callbacks[1]);
    };

    await rejects(
      [payerPosition],
      "InvalidTreasuryAccount",
      "counted a position with the wrong authority",
    );
    await rejects(
      [foreignPosition],
      "InvalidTreasuryAccount",
      "counted a foreign DAO's position",
    );
    await rejects(
      [forgedPosition],
      "InvalidTreasuryAccount",
      "counted a forged position at a non-PDA address",
    );
    await rejects(
      [payerQuoteAccount],
      "InvalidTreasuryAccount",
      "counted a token account the vault doesn't own",
    );
    await rejects(
      [vaultBaseAccount],
      "InvalidTreasuryAccount",
      "counted a vault account of the wrong mint",
    );
    await rejects(
      [dao],
      "AccountDiscriminatorMismatch",
      "counted another futarchy account type",
    );
    await rejects(
      [vaultQuoteAccount, vaultQuoteAccount],
      "TreasuryAccountsNotSorted",
      "accepted a duplicated treasury account",
    );
    await rejects(
      sortKeys([vaultQuoteAccount, vaultPosition]).reverse(),
      "TreasuryAccountsNotSorted",
      "accepted an unsorted treasury list",
    );
  });

  it("refuses a treasury list on a non-buyback launch", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const memoIx = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from("arbitrary", "utf8"),
    });
    const { proposal, squadsProposal } = await this.initializeProposal({
      dao,
      instructions: [memoIx],
    });

    const callbacks = expectError(
      "UnexpectedLaunchAccounts",
      "launched a non-buyback proposal with a treasury list",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: [vaultQuoteAccount],
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("stamps no cooldown on an admin cancel, so a new buyback launches immediately", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    // Assert that the test environment's clock is not zero (would mess with program assumptions)
    let clock = await this.banksClient.getClock();
    assert.isTrue(clock.unixTimestamp > 0n);

    const first = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: first.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: first.squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    await adminCancel(this, { dao, proposal: first.proposal });

    const cancelledProposal = await this.futarchy.getProposal(first.proposal);
    assert.exists(cancelledProposal.state.failed);

    clock = await this.banksClient.getClock();
    assert.isTrue(clock.unixTimestamp > BigInt(NINETY_DAYS_IN_SECONDS));

    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.lastBuybackFinalizedAt.toString(), "0");

    const second = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    const storedProposal = await this.futarchy.getProposal(second.proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("blocks a second buyback for 90 days after a pass", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const first = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: first.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: first.squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal: first.proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    const clock = await this.banksClient.getClock();
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(
      storedDao.lastBuybackFinalizedAt.toString(),
      clock.unixTimestamp.toString(),
    );

    const second = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    const treasuryAccounts =
      await this.futarchy.assembleBuybackTreasuryAccounts({ dao });

    const callbacks = expectError(
      "ProposalKindCooldownActive",
      "launched a buyback inside the cooldown of a passed one",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
        treasuryAccounts,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // The 90-day cooldown gate is inclusive of its final second
    await this.advanceBySeconds(NINETY_DAYS_IN_SECONDS);

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
        treasuryAccounts,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(second.proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("blocks a second buyback for 90 days after a failure", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const first = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: first.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: first.squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    await failProposal(this, {
      dao,
      proposal: first.proposal,
      baseMint: META,
      quoteMint: USDC,
    });

    const clock = await this.banksClient.getClock();
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(
      storedDao.lastBuybackFinalizedAt.toString(),
      clock.unixTimestamp.toString(),
    );

    const second = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    const treasuryAccounts =
      await this.futarchy.assembleBuybackTreasuryAccounts({ dao });

    const callbacks = expectError(
      "ProposalKindCooldownActive",
      "launched a buyback inside the cooldown of a failed one",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
        treasuryAccounts,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.advanceBySeconds(NINETY_DAYS_IN_SECONDS);

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
        treasuryAccounts,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(second.proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("executes end to end with a signer-less payload", async function () {
    await this.mintTo(USDC, vault, this.payer, 1_600 * 1_000_000);

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        treasuryAccounts: await this.futarchy.assembleBuybackTreasuryAccounts({
          dao,
        }),
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // Executing is permissionless and separate from finalization; the memo
    // program failing would fail this whole transaction
    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.equal(storedSquadsProposal.status.__kind, "Executed");
  });

  it("rejects a zero total", async function () {
    const callbacks = expectError(
      "InvalidBuybackAmount",
      "created a buyback with a zero total",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(0),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("accepts a total that doesn't split evenly across the cycles", async function () {
    // 100 USDC over 3 cycles: the venue puts the remainder in the last order,
    // so the mandate records the total and the count as given
    const { proposal } = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(100_000_000),
      cycleCount: 3,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    const action = (await this.futarchy.getProposal(proposal)).action
      .buybackToken;
    assert.equal(action.quoteAmount.toString(), "100000000");
    assert.equal(action.cycleCount, 3);
  });

  it("rejects a single-cycle programme", async function () {
    const callbacks = expectError(
      "InvalidBuybackCycleCount",
      "created a single-cycle buyback",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(100_000_000),
        cycleCount: 1,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects an inverted price band", async function () {
    const callbacks = expectError(
      "InvalidBuybackPriceBand",
      "created a buyback with min_price above max_price",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 0,
        minPrice: new BN(2_000_000),
        maxPrice: new BN(1_600_000),
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a sub-minute cadence", async function () {
    const callbacks = expectError(
      "InvalidBuybackCycleFrequency",
      "created a buyback with a sub-minute cadence",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 59,
        startDelaySeconds: 0,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a cadence beyond a year", async function () {
    const callbacks = expectError(
      "InvalidBuybackCycleFrequency",
      "created a buyback with a cadence beyond a year",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 365 * 24 * 60 * 60 + 1,
        startDelaySeconds: 0,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a start delay past 30 days", async function () {
    const callbacks = expectError(
      "InvalidBuybackStartDelay",
      "created a buyback starting more than 30 days out",
    );

    await this.futarchy
      .initializeBuybackTokenProposal({
        dao,
        quoteAmount: new BN(400_000_000),
        cycleCount: 80,
        cycleFrequencySeconds: 86_400,
        startDelaySeconds: 30 * 24 * 60 * 60 + 1,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("can't be retuned by admin_update_proposal_params", async function () {
    const { proposal } = await this.futarchy.initializeBuybackTokenProposal({
      dao,
      quoteAmount: new BN(400_000_000),
      cycleCount: 80,
      cycleFrequencySeconds: 86_400,
      startDelaySeconds: 0,
    });

    const callbacks = expectError(
      "InvalidProposalKind",
      "retuned a draft buyback's market parameters",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: 60 * 60 * 24 * 5,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
