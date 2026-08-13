import conditionalVault from "./conditionalVault/main.test.js";
import futarchy from "./futarchy/main.test.js";
import launchpad from "./launchpad/main.test.js";
import launchpad_v7 from "./launchpad_v7/main.test.js";
import launchpad_v8 from "./launchpad_v8/main.test.js";
import priceBasedPerformancePackage from "./priceBasedPerformancePackage/main.test.js";
import bidWall from "./bidWall/main.test.js";
import mintGovernor from "./mintGovernor/main.test.js";
import performancePackageV2 from "./performancePackageV2/main.test.js";
import liquidation from "./liquidation/main.test.js";
import gatedMint from "./gatedMint/main.test.js";
import relaunch from "./relaunch/main.test.js";

import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import {
  FutarchyClient,
  ConditionalVaultClient,
  LaunchpadClient as LaunchpadClientV7,
  PriceBasedPerformancePackageClient,
  MAINNET_USDC,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_ID,
  PERMISSIONLESS_ACCOUNT,
  getDaoAddr,
  PriceMath,
  getProposalAddr,
  getProposalAddrV2,
  InstructionUtils,
  getPerformancePackageAddr,
  DAMM_V2_PROGRAM_ID,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
  BidWallClient,
  MintGovernorClient,
  GatedMintClient,
  LiquidationClient,
  RelaunchClient,
  LOW_FEE_RAYDIUM_CONFIG,
  PUMP_AMM_FEE_CONFIG,
  PUMP_AMM_GLOBAL_CONFIG,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEES_PROGRAM_ID,
  RELAUNCH_V0_1_GLOBAL_ALT,
  WHIRLPOOL_PROGRAM_ID,
  sha256,
} from "@metadaoproject/programs";
import { PUMP_GLOBAL_VOLUME_ACCUMULATOR } from "./relaunch/pumpAmm.js";
import { RAYDIUM_AMM_PROGRAM_ID } from "./relaunch/raydiumAmm.js";
import { WHIRLPOOLS_CONFIG, WHIRLPOOL_FEE_TIER } from "./relaunch/whirlpool.js";
import { LaunchpadClient as LaunchpadClientV6 } from "@metadaoproject/programs/launchpad/v0.6";
import { LaunchpadClient as LaunchpadClientV8 } from "@metadaoproject/programs/launchpad/v0.8";

import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  AddressLookupTableProgram,
} from "@solana/web3.js";

import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  getAccount,
  transfer,
  getMint,
  mintToOverride,
} from "spl-token-bankrun";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import * as fs from "fs";
import { AccountInfo } from "@solana/web3.js";

const MPL_TOKEN_METADATA_PROGRAM_ID = toWeb3JsPublicKey(
  UMI_MPL_TOKEN_METADATA_PROGRAM_ID,
);
const RAYDIUM_CP_SWAP_PROGRAM_ID = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
);

import mintAndSwap from "./integration/mintAndSwap.test.js";
import fullLaunch from "./integration/fullLaunch.test.js";
import fullLaunch_v7 from "./integration/fullLaunch_v7.test.js";
import fullLaunch_v8 from "./integration/launchpad_v8_full_lifecycle.test.js";
import gatedLaunchpadV8 from "./integration/gatedLaunchpadV8.test.js";
import trancheLifecycle_v8 from "./integration/launchpad_v8_tranche_lifecycle.test.js";
import relaunchLifecycle from "./integration/relaunch.test.js";
import { BN } from "bn.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

// Export the test context interface for use in other files
export interface TestContext {
  context: ProgramTestContext;
  banksClient: BanksClient;
  connection: Connection;
  conditionalVault: ConditionalVaultClient;
  futarchy: FutarchyClient;
  launchpad_v7: LaunchpadClientV7;
  launchpad_v8: LaunchpadClientV8;
  launchpad_v6: LaunchpadClientV6;
  priceBasedPerformancePackage: PriceBasedPerformancePackageClient;
  bidWall: BidWallClient;
  mintGovernor: MintGovernorClient;
  gatedMint: GatedMintClient;
  liquidation: LiquidationClient;
  relaunch: RelaunchClient;
  payer: Keypair;
  squadsConnection: Connection;
  createTokenAccount: (mint: PublicKey, owner: PublicKey) => Promise<PublicKey>;
  createMint: (
    mintAuthority: PublicKey,
    decimals: number,
  ) => Promise<PublicKey>;
  mintTo: (
    mint: PublicKey,
    to: PublicKey,
    mintAuthority: Keypair,
    amount: number,
    computeUnitPrice?: number,
  ) => Promise<any>;
  getTokenBalance: (mint: PublicKey, owner: PublicKey) => Promise<bigint>;
  getMint: (mint: PublicKey) => Promise<any>;
  assertBalance: (
    mint: PublicKey,
    owner: PublicKey,
    amount: number,
  ) => Promise<void>;
  transfer: (
    mint: PublicKey,
    from: Keypair,
    to: PublicKey,
    amount: number,
  ) => Promise<any>;
  setupBasicDao: ({
    baseMint,
    quoteMint,
    teamSponsoredPassThresholdBps,
    teamAddress,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    teamSponsoredPassThresholdBps?: number;
    teamAddress?: PublicKey;
  }) => Promise<PublicKey>;
  setupBasicDaoWithLiquidity: ({
    baseMint,
    quoteMint,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
  }) => Promise<PublicKey>;
  initializeProposal: ({
    dao,
    instructions,
  }: {
    dao: PublicKey;
    instructions: TransactionInstruction[];
  }) => Promise<{
    proposal: PublicKey;
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    squadsProposal: PublicKey;
  }>;
  initializeAndLaunchProposal: ({
    dao,
    instructions,
  }: {
    dao: PublicKey;
    instructions: TransactionInstruction[];
  }) => Promise<{
    proposal: PublicKey;
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    squadsProposal: PublicKey;
  }>;
  advanceBySlots: (slots: bigint) => Promise<void>;
  advanceBySeconds: (seconds: number) => Promise<void>;
}

// Extend the Mocha context to include our test properties
declare module "mocha" {
  interface Context extends TestContext {}
}

before(async function () {
  this.context = await startAnchor(
    "./",
    [
      // even though the program is loaded into the test validator, we need
      // to tell banks test client to load it as well
      {
        name: "mpl_token_metadata",
        programId: MPL_TOKEN_METADATA_PROGRAM_ID,
      },
      {
        name: "squads_multisig",
        programId: SQUADS_PROGRAM_ID,
      },
      {
        name: "cp_amm",
        programId: DAMM_V2_PROGRAM_ID,
      },
      {
        name: "pump_amm",
        programId: PUMP_AMM_PROGRAM_ID,
      },
      {
        name: "pump_fees",
        programId: PUMP_FEES_PROGRAM_ID,
      },
      {
        name: "whirlpool",
        programId: WHIRLPOOL_PROGRAM_ID,
      },
      {
        name: "raydium_amm",
        programId: RAYDIUM_AMM_PROGRAM_ID,
      },
    ],
    [
      {
        address: LOW_FEE_RAYDIUM_CONFIG,
        info: {
          data: fs.readFileSync("./tests/fixtures/raydium-amm-config"),
          executable: false,
          owner: RAYDIUM_CP_SWAP_PROGRAM_ID,
          lamports: 1_000_000_000,
        },
      },
      {
        address: RAYDIUM_CREATE_POOL_FEE_RECEIVE,
        info: {
          data: fs.readFileSync(
            "./tests/fixtures/raydium-create-pool-fee-receive",
          ),
          executable: false,
          owner: token.TOKEN_PROGRAM_ID,
          lamports: 6858_402_039_280,
        },
      },
      {
        address: MAINNET_USDC,
        info: {
          data: fs.readFileSync("./tests/fixtures/usdc"),
          executable: false,
          owner: token.TOKEN_PROGRAM_ID,
          lamports: 377_950_832_219,
        },
      },
      {
        address: SQUADS_PROGRAM_CONFIG,
        info: {
          data: fs.readFileSync("./tests/fixtures/squads-program-config"),
          executable: false,
          owner: SQUADS_PROGRAM_ID,
          lamports: 1_000_000_000,
        },
      },
      {
        address: new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
        info: {
          data: fs.readFileSync("./tests/fixtures/dynamic-config"),
          executable: false,
          owner: DAMM_V2_PROGRAM_ID,
          lamports: 1_000_000_000,
        },
      },
      {
        address: PUMP_AMM_GLOBAL_CONFIG,
        info: {
          data: fs.readFileSync("./tests/fixtures/pump-global-config"),
          executable: false,
          owner: PUMP_AMM_PROGRAM_ID,
          lamports: 9_215_825,
        },
      },
      {
        address: PUMP_AMM_FEE_CONFIG,
        info: {
          data: fs.readFileSync("./tests/fixtures/pump-fee-config"),
          executable: false,
          owner: PUMP_FEES_PROGRAM_ID,
          lamports: 33_103_977,
        },
      },
      {
        address: PUMP_GLOBAL_VOLUME_ACCUMULATOR,
        info: {
          data: fs.readFileSync(
            "./tests/fixtures/pump-global-volume-accumulator",
          ),
          executable: false,
          owner: PUMP_AMM_PROGRAM_ID,
          lamports: 28_668_918,
        },
      },
      {
        address: token.NATIVE_MINT,
        info: {
          data: fs.readFileSync("./tests/fixtures/wsol-mint"),
          executable: false,
          owner: token.TOKEN_PROGRAM_ID,
          lamports: 1_642_232_546_455,
        },
      },
      {
        address: WHIRLPOOLS_CONFIG,
        info: {
          data: fs.readFileSync("./tests/fixtures/whirlpool-config"),
          executable: false,
          owner: WHIRLPOOL_PROGRAM_ID,
          lamports: 1_642_560,
        },
      },
      {
        address: WHIRLPOOL_FEE_TIER,
        info: {
          data: fs.readFileSync("./tests/fixtures/whirlpool-fee-tier"),
          executable: false,
          owner: WHIRLPOOL_PROGRAM_ID,
          lamports: 1_197_120,
        },
      },
      {
        // Dumped by `yarn relaunch-create-alt dump`, which zeroes
        // last_extended_slot so every entry is active at bankrun's low slots.
        address: RELAUNCH_V0_1_GLOBAL_ALT,
        info: {
          data: fs.readFileSync("./tests/fixtures/relaunch-global-alt"),
          executable: false,
          owner: AddressLookupTableProgram.programId,
          lamports: 41_815_680,
        },
      },
    ],
  );
  this.banksClient = this.context.banksClient;
  const provider = new BankrunProvider(this.context);
  anchor.setProvider(provider);
  // web3.js implements getAddressLookupTable purely in terms of
  // getAccountInfoAndContext, which the bankrun connection proxy provides, so
  // grafting the real implementation on lets tests fetch lookup tables the
  // same way a script would.
  (provider.connection as any).getAddressLookupTable =
    Connection.prototype.getAddressLookupTable;
  this.connection = provider.connection;

  this.conditionalVault = ConditionalVaultClient.createClient({
    provider: provider as any,
  });
  this.futarchy = FutarchyClient.createClient({
    provider: provider as any,
  });
  this.launchpad_v7 = LaunchpadClientV7.createClient({
    provider: provider as any,
  });
  this.launchpad_v8 = LaunchpadClientV8.createClient({
    provider: provider as any,
  });
  this.launchpad_v6 = LaunchpadClientV6.createClient({
    provider: provider as any,
  });
  this.priceBasedPerformancePackage =
    PriceBasedPerformancePackageClient.createClient({
      provider: provider as any,
    });
  this.bidWall = BidWallClient.createClient({
    provider: provider as any,
  });
  this.liquidation = LiquidationClient.createClient({
    provider: provider as any,
  });
  this.provider = provider;
  this.payer = provider.wallet.payer;

  // Moved these into individual v6/v7 launchpad test suites
  // const dynamicConfig = await this.banksClient.getAccount(
  //   new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
  // );

  // // discriminator + vault config authority
  // const poolCreatorAuthorityOffset = 8 + 32;
  // // discriminator + vault config authority + pool creator authority + pool fees config + activation type + collect fee mode
  // const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

  // const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
  //   [Buffer.from("damm_pool_creator_authority")],
  //   LAUNCHPAD_PROGRAM_ID,
  // );

  // dynamicConfig.data.set(
  //   poolCreatorAuthority.toBuffer(),
  //   poolCreatorAuthorityOffset,
  // );
  // dynamicConfig.data.set([1], configTypeOffset);

  // this.context.setAccount(MAINNET_METEORA_CONFIG, dynamicConfig);
  // const creatorAuthority = new PublicKey(
  //   dynamicConfig.data.subarray(
  //     poolCreatorAuthorityOffset,
  //     poolCreatorAuthorityOffset + 32,
  //   ),
  // );
  // console.log(creatorAuthority);
  // console.log(this.payer.publicKey);
  // console.log(
  //   dynamicConfig.data.subarray(
  //     poolCreatorAuthorityOffset,
  //     poolCreatorAuthorityOffset + 32,
  //   ),
  // );
  // console.log(dynamicConfig.data.toString());

  this.squadsConnection = {
    getAccountInfo: async (address: PublicKey) => {
      const rawAccount = await this.banksClient.getAccount(address);
      const accountInfo: AccountInfo<Buffer> = {
        executable: false,
        owner: rawAccount.owner,
        lamports: rawAccount.lamports,
        data: Buffer.from(rawAccount.data),
      };
      return accountInfo;
    },
  } as Connection;

  const assignIx = SystemProgram.assign({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    programId: SystemProgram.programId,
  });

  const allocateIx = SystemProgram.allocate({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    space: 8,
  });

  const transferIx = SystemProgram.transfer({
    fromPubkey: this.payer.publicKey,
    toPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    lamports: 1000000000,
  });
  const assignTx = new Transaction().add(allocateIx, assignIx, transferIx);
  assignTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  assignTx.feePayer = this.payer.publicKey;
  assignTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

  await this.banksClient.processTransaction(assignTx);

  this.createTokenAccount = async (mint: PublicKey, owner: PublicKey) => {
    return await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      mint,
      owner,
    );
  };

  this.createMint = async (mintAuthority: PublicKey, decimals: number) => {
    return await createMint(
      this.banksClient,
      this.payer,
      mintAuthority,
      null,
      decimals,
    );
  };

  // computeUnitPrice, when set, prepends a ComputeBudget instruction so an
  // otherwise byte-identical mint transaction gets a unique hash — bankrun
  // rejects duplicate hashes within a blockhash window with "This transaction
  // has already been processed".
  this.mintTo = async (
    mint: PublicKey,
    to: PublicKey,
    mintAuthority: Keypair,
    amount: number,
    computeUnitPrice?: number,
  ) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, to, true);

    const tx = new Transaction();

    if (computeUnitPrice !== undefined) {
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: computeUnitPrice,
        }),
      );
    }

    tx.add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        tokenAccount,
        to,
        mint,
      ),
    );
    tx.add(
      token.createMintToInstruction(
        mint,
        tokenAccount,
        mintAuthority.publicKey,
        amount,
      ),
    );

    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, mintAuthority);
    await this.banksClient.processTransaction(tx);
  };

  this.getTokenBalance = async (mint: PublicKey, owner: PublicKey) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, owner, true);
    try {
      const storedTokenAccount = await getAccount(
        this.banksClient,
        tokenAccount,
      );
      return storedTokenAccount.amount;
    } catch (error) {
      if (error.toString().includes("TokenAccountNotFoundError")) {
        return 0n;
      }
      throw error;
    }
  };

  this.getMint = async (mint: PublicKey) => {
    return await getMint(this.banksClient, mint);
  };

  this.assertBalance = async (
    mint: PublicKey,
    owner: PublicKey,
    amount: number,
  ) => {
    const balance = await this.getTokenBalance(mint, owner);
    assert.equal(balance.toString(), amount.toString());
    // const tokenAccount = token.getAssociatedTokenAddressSync(mint, owner, true);
    // const storedTokenAccount = await getAccount(this.banksClient, tokenAccount);
    // assert.equal(storedTokenAccount.amount.toString(), amount.toString());
  };

  this.transfer = async (
    mint: PublicKey,
    from: Keypair,
    to: PublicKey,
    amount: number,
  ) => {
    return await transfer(
      this.banksClient,
      this.payer,
      token.getAssociatedTokenAddressSync(mint, from.publicKey, true),
      token.getAssociatedTokenAddressSync(mint, to, true),
      from,
      amount,
    );
  };

  this.advanceBySlots = async (slots: bigint) => {
    const currentClock = await this.context.banksClient.getClock();
    this.context.setClock(
      new Clock(
        currentClock.slot + slots,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp,
      ),
    );
  };

  this.advanceBySeconds = async (seconds: number) => {
    const currentClock = await this.context.banksClient.getClock();
    this.context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(currentClock.unixTimestamp + BigInt(seconds)),
      ),
    );
  };

  this.setupBasicDao = async ({
    baseMint,
    quoteMint,
    teamSponsoredPassThresholdBps = 300,
    teamAddress = this.payer.publicKey,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    teamSponsoredPassThresholdBps?: number;
    teamAddress?: PublicKey;
  }) => {
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint,
        quoteMint,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: ONE_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: ONE_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: null,
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps,
          teamAddress,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    return dao;
  };

  this.setupBasicDaoWithLiquidity = async ({
    baseMint,
    quoteMint,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
  }) => {
    const dao = await this.setupBasicDao({ baseMint, quoteMint });

    await this.mintTo(
      baseMint,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );
    await this.mintTo(
      quoteMint,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint,
        quoteMint,
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        quoteAmount: new BN(100_000 * 10 ** 6),
      })
      .rpc();

    return dao;
  };

  this.initializeProposal = async ({
    dao,
    instructions,
  }: {
    dao: PublicKey;
    instructions: TransactionInstruction[];
  }): Promise<{
    proposal: PublicKey;
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    squadsProposal: PublicKey;
  }> => {
    const storedDao = await this.futarchy.getDao(dao);

    const { tx: squadsProposalCreateTx, squadsProposal } =
      this.futarchy.squadsProposalCreateTx({
        dao,
        instructions,
        transactionIndex: 1n,
      });

    squadsProposalCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsProposalCreateTx.feePayer = this.payer.publicKey;
    squadsProposalCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    this.banksClient.processTransaction(squadsProposalCreateTx);

    let [proposal] = getProposalAddrV2({ squadsProposal });

    await this.conditionalVault.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2,
    );

    const { question, baseVault, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      storedDao.baseMint,
      storedDao.quoteMint,
      dao,
    );

    await this.conditionalVault
      .initializeVaultIx(question, storedDao.baseMint, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.conditionalVault.initializeVaultIx(
            question,
            storedDao.quoteMint,
            2,
          ),
        ),
      )
      .rpc();

    await this.futarchy
      .initializeProposalIx(
        squadsProposal,
        dao,
        storedDao.baseMint,
        storedDao.quoteMint,
        question,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    return { proposal, question, baseVault, quoteVault, squadsProposal };
  };

  this.initializeAndLaunchProposal = async ({
    dao,
    instructions,
  }: {
    dao: PublicKey;
    instructions: TransactionInstruction[];
  }): Promise<{
    proposal: PublicKey;
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    squadsProposal: PublicKey;
  }> => {
    const { proposal, question, baseVault, quoteVault, squadsProposal } =
      await this.initializeProposal({ dao, instructions });
    const storedDao = await this.futarchy.getDao(dao);
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: storedDao.baseMint,
        quoteMint: storedDao.quoteMint,
        squadsProposal,
      })
      .rpc();

    return { proposal, question, baseVault, quoteVault, squadsProposal };
  };

  this.setupBasicPerformancePackage = async ({
    tokenMint,
    oracleAccount,
    recipient,
  }: {
    tokenMint: PublicKey;
    oracleAccount: PublicKey;
    recipient: PublicKey;
  }): Promise<PublicKey> => {
    const createKey = Keypair.generate();

    await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params: {
          tranches: [
            {
              priceThreshold: new BN(1e12),
              tokenAmount: new BN(100 * 10 ** 6),
            },
            {
              priceThreshold: new BN(2e12),
              tokenAmount: new BN(100 * 10 ** 6),
            },
          ],
          grantee: recipient,
          performancePackageAuthority: this.payer.publicKey,
          minUnlockTimestamp: new BN(
            Number((await this.context.banksClient.getClock()).unixTimestamp) +
              1,
          ),
          oracleConfig: {
            oracleAccount,
            byteOffset: 0,
          },
          twapLengthSeconds: 24 * 60 * 60, // 1 day, the minimum
        },
        createKey: createKey.publicKey,
        tokenMint,
        grantor: this.payer.publicKey,
      })
      .signers([createKey])
      .rpc();

    return getPerformancePackageAddr({
      createKey: createKey.publicKey,
    })[0];
  };

  // this.setupBasicLaunch = async ({
  //   baseMint,
  //   founders,
  //   launchAuthority,
  // }: {
  //   baseMint: PublicKey;
  //   founders: PublicKey[];
  //   launchAuthority: PublicKey;
  // }) => {
  //   await this.launchpad
  //     .initializeLaunchIx({
  //       tokenName: "META",
  //       tokenSymbol: "META",
  //       tokenUri: "https://example.com",
  //       minimumRaiseAmount: new BN(100_000 * 10 ** 6), // 100k
  //       secondsForLaunch: 60 * 60 * 24 * 4, // 4 days
  //       baseMint,
  //       quoteMint: MAINNET_USDC,
  //       monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6), // 15k burn
  //       monthlySpendingLimitMembers: founders,
  //       performancePackageGrantee: founders[0],
  //       performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6), // 5M
  //       monthsUntilInsidersCanUnlock: 24, // 2 years
  //       teamAddress: PublicKey.default,
  //       launchAuthority: launchAuthority,
  //     })
  //     .rpc();
  // };

  await this.createTokenAccount(MAINNET_USDC, this.payer.publicKey);
  await mintToOverride(
    this.context,
    token.getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
    100_000_000n * 10n ** 6n,
  );
});

describe("launchpad", launchpad);
describe("launchpad_v7", launchpad_v7);
describe("launchpad_v8", launchpad_v8);
describe("price_based_performance_package", priceBasedPerformancePackage);
describe("conditional_vault", conditionalVault);
describe("futarchy", futarchy);
describe("bid_wall", bidWall);
describe("mint_governor", mintGovernor);
describe("performance_package_v2", performancePackageV2);
describe("liquidation", liquidation);
describe("gated_mint", gatedMint);
describe("relaunch", relaunch);
describe("project-wide integration tests", function () {
  it.skip("mint and swap in a single transaction", mintAndSwap);
  describe("full launch v6", fullLaunch);
  describe("full launch v7", fullLaunch_v7);
  describe("full launch v8", fullLaunch_v8);
  describe("gated_mint + launchpad v8", gatedLaunchpadV8);
  describe("full launch v8 - tranche lifecycle", trancheLifecycle_v8);
  describe("relaunch full lifecycle", relaunchLifecycle);
});
