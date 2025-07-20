import conditionalVault from "./conditionalVault/main.test.js";
import autocrat from "./autocrat/main.test.js";
import launchpad from "./launchpad/main.test.js";
import sharedLiquidityManager from "./sharedLiquidityManager/main.test.js";

import {
  BanksClient,
  Clock,
  ProgramTestContext,
  startAnchor,
} from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ConditionalVaultClient,
  LaunchpadClient,
  SharedLiquidityManagerClient,
  MAINNET_USDC,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_ID,
  PERMISSIONLESS_ACCOUNT,
  AUTOCRAT_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.5";
// import {
//   // AmmClient,
//   // AutocratClient,
//   // ConditionalVaultClient,
//   getVersion,
//   VersionKey
// } from "@metadaoproject/futarchy";
import { PublicKey, Keypair, Connection, SystemProgram, Transaction } from "@solana/web3.js";
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
import { LOW_FEE_RAYDIUM_CONFIG } from "@metadaoproject/futarchy/v0.4";
import { LiteSVM } from "litesvm";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";

const MPL_TOKEN_METADATA_PROGRAM_ID = toWeb3JsPublicKey(
  UMI_MPL_TOKEN_METADATA_PROGRAM_ID
);
const RAYDIUM_CP_SWAP_PROGRAM_ID = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
);

import mintAndSwap from "./integration/mintAndSwap.test.js";
import scalarMarkets from "./integration/scalarMarkets.test.js";
import twap from "./integration/twap.test.js";
import fullLaunch from "./integration/fullLaunch.test.js";

// Extend the Mocha context to include our test properties
declare module "mocha" {
  interface Context {
    svm: LiteSVM;
    svmProvider: LiteSVMProvider;
    svmAutocratClient: AutocratClient;
    svmVaultClient: ConditionalVaultClient;
    context: ProgramTestContext;
    banksClient: BanksClient;
    vaultClient: ConditionalVaultClient;
    autocratClient: AutocratClient;
    launchpadClient: LaunchpadClient;
    sharedLiquidityManagerClient: SharedLiquidityManagerClient;
    payer: Keypair;
    squadsConnection: Connection;
    createTokenAccount: (
      mint: PublicKey,
      owner: PublicKey
    ) => Promise<PublicKey>;
    createMint: (
      mintAuthority: PublicKey,
      decimals: number
    ) => Promise<PublicKey>;
    mintTo: (
      mint: PublicKey,
      to: PublicKey,
      mintAuthority: Keypair,
      amount: number
    ) => Promise<any>;
    getTokenBalance: (mint: PublicKey, owner: PublicKey) => Promise<bigint>;
    getMint: (mint: PublicKey) => Promise<any>;
    assertBalance: (
      mint: PublicKey,
      owner: PublicKey,
      amount: number
    ) => Promise<void>;
    transfer: (
      mint: PublicKey,
      from: Keypair,
      to: PublicKey,
      amount: number
    ) => Promise<any>;
    advanceBySlots: (slots: bigint) => Promise<void>;
    advanceBySeconds: (seconds: number) => Promise<void>;
  }
}

before(async function () {
  // const version: VersionKey = "0.4";
  // const { AmmClient, AutocratClient, ConditionalVaultClient } = getVersion(version);

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
        name: "raydium_cp_swap",
        programId: RAYDIUM_CP_SWAP_PROGRAM_ID,
      },
      {
        name: "squads_multisig",
        programId: SQUADS_PROGRAM_ID,
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
            "./tests/fixtures/raydium-create-pool-fee-receive"
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
    ]
  );
  this.banksClient = this.context.banksClient;
  let provider = new BankrunProvider(this.context);
  anchor.setProvider(provider);

  // umi = createUmi(anchor.AnchorProvider.env().connection);

  this.vaultClient = ConditionalVaultClient.createClient({
    provider: provider as any,
  });
  this.autocratClient = AutocratClient.createClient({
    provider: provider as any,
  });
  this.launchpadClient = LaunchpadClient.createClient({
    provider: provider as any,
  });
  this.provider = provider;
  this.sharedLiquidityManagerClient = SharedLiquidityManagerClient.createClient(
    { provider: provider as any }
  );
  this.payer = provider.wallet.payer;

  this.squadsConnection = {
    getAccountInfo: async (address: PublicKey) => {
      let rawAccount = await this.banksClient.getAccount(address);
      let accountInfo: AccountInfo<Buffer> = {
        executable: false,
        owner: rawAccount.owner,
        lamports: rawAccount.lamports,
        data: Buffer.from(rawAccount.data),
      };
      return accountInfo;
    },
  } as Connection;

  console.log("assigning permissionless account to autocrat program");

  let assignIx = SystemProgram.assign({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    programId: SystemProgram.programId,
  });

  let allocateIx = SystemProgram.allocate({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    space: 8,
  })

  let transferIx = SystemProgram.transfer({
    fromPubkey: this.payer.publicKey,
    toPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    lamports: 1000000000,
  })
  console.log("assigning permissionless account to autocrat program");
  let assignTx = new Transaction().add(allocateIx, assignIx, transferIx);
  assignTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  assignTx.feePayer = this.payer.publicKey;
  assignTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
  console.log("assigning permissionless account to autocrat program");

  await this.banksClient.processTransaction(assignTx);
  // console.log("assigning permissionless account to autocrat program");

  // const assignTx2 = new Transaction().add(SystemProgram.assign({
  //   accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
  //   programId: SQUADS_PROGRAM_ID,
  // }));
  // assignTx2.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // assignTx2.feePayer = this.payer.publicKey;
  // assignTx2.sign(this.payer, PERMISSIONLESS_ACCOUNT);
  // await this.banksClient.processTransaction(assignTx2);

  // console.log(await this.banksClient.getAccount(PERMISSIONLESS_ACCOUNT.publicKey));

  // throw new Error("stop here");


  this.createTokenAccount = async (mint: PublicKey, owner: PublicKey) => {
    return await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      mint,
      owner
    );
  };

  this.createMint = async (mintAuthority: PublicKey, decimals: number) => {
    return await createMint(
      this.banksClient,
      this.payer,
      mintAuthority,
      null,
      decimals
    );
  };

  this.mintTo = async (
    mint: PublicKey,
    to: PublicKey,
    mintAuthority: Keypair,
    amount: number
  ) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, to, true);
    return await mintTo(
      this.banksClient,
      this.payer,
      mint,
      tokenAccount,
      mintAuthority,
      amount
    );
  };

  this.getTokenBalance = async (mint: PublicKey, owner: PublicKey) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, owner, true);
    const storedTokenAccount = await getAccount(this.banksClient, tokenAccount);
    return storedTokenAccount.amount;
  };

  this.getMint = async (mint: PublicKey) => {
    return await getMint(this.banksClient, mint);
  };

  this.assertBalance = async (
    mint: PublicKey,
    owner: PublicKey,
    amount: number
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
    amount: number
  ) => {
    return await transfer(
      this.banksClient,
      this.payer,
      token.getAssociatedTokenAddressSync(mint, from.publicKey, true),
      token.getAssociatedTokenAddressSync(mint, to, true),
      from,
      amount
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
        currentClock.unixTimestamp
      )
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
        BigInt(currentClock.unixTimestamp + BigInt(seconds))
      )
    );
  };

  await this.createTokenAccount(MAINNET_USDC, this.payer.publicKey);
  await mintToOverride(
    this.context,
    token.getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
    10_000_000n * 10n ** 6n
  );
});

describe("conditional_vault", conditionalVault);
describe("autocrat", autocrat);
describe("launchpad", launchpad);
// describe("shared_liquidity_manager", sharedLiquidityManager);
describe("project-wide integration tests", function () {
  it("mint and swap in a single transaction", mintAndSwap);
  it(
    "tests scalar markets (mint, split, swap, redeem) with some fuzzing",
    scalarMarkets
  );
  it("tests twap functionality (crankThatTwap, twapStartDelaySlots)", twap);
  describe("full launch", fullLaunch);
});
