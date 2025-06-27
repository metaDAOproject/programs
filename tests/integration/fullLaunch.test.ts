import {
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  LaunchpadClient,
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
  MAINNET_USDC,
  PriceMath,
} from "@metadaoproject/futarchy/v0.5";
import { BN } from "bn.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import { initializeMintWithSeeds } from "../launchpad/utils.js";
import * as token from "@solana/spl-token";

export default async function suite() {
  // Create multiple funders
  const funder1 = Keypair.generate();
  const funder2 = Keypair.generate();
  const funder3 = Keypair.generate();

  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let dao: PublicKey;
  let daoTreasury: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const launchPeriod = 60 * 60 * 24 * 2; // 2 days

  // Initialize the launch
  const result = await initializeMintWithSeeds(
    this.banksClient,
    this.launchpadClient,
    this.payer
  );

  META = result.tokenMint;
  launch = result.launch;
  launchSigner = result.launchSigner;

  // Setup token accounts for funders
  await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
  await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
  await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);

  // Mint USDC to funders
  await this.transfer(MAINNET_USDC, this.payer, funder1.publicKey, 5000_000000);
  await this.transfer(MAINNET_USDC, this.payer, funder2.publicKey, 3000_000000);
  await this.transfer(MAINNET_USDC, this.payer, funder3.publicKey, 4000_000000);

  // Initialize launch
  await this.launchpadClient
    .initializeLaunchIx(
      "META",
      "META",
      "https://example.com",
      minRaise,
      launchPeriod,
      META
    )
    .rpc();

  // Start launch
  await this.launchpadClient.startLaunchIx(launch).rpc();

  // Fund from multiple sources
  await this.launchpadClient
    .fundIx(launch, new BN(5000_000000), funder1.publicKey)
    .signers([funder1])
    .rpc();

  await this.launchpadClient.fundIx(launch, new BN(1500_000000)).rpc();

  await this.launchpadClient
    .fundIx(launch, new BN(3500_000000), funder3.publicKey)
    .signers([funder3])
    .rpc();

  // Advance time and complete launch
  await this.advanceBySeconds(launchPeriod + 3600);

  await this.launchpadClient
    .completeLaunchIx(launch, META)
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
    ])
    .rpc();

  // Verify launch completion and DAO creation
  const launchAccount = await this.launchpadClient.fetchLaunch(launch);
  assert.exists(launchAccount.state.complete);
  assert.exists(launchAccount.dao);
  dao = launchAccount.dao;
  daoTreasury = launchAccount.daoTreasury;

  // Claim tokens for all funders
  await this.launchpadClient.claimIx(launch, META, funder1.publicKey).rpc();

  await this.launchpadClient.claimIx(launch, META).rpc();

  await this.launchpadClient.claimIx(launch, META, funder3.publicKey).rpc();

  // Verify token distributions
  const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
  const payerBalance = await this.getTokenBalance(META, this.payer.publicKey);
  const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);

  assert.equal(funder1Balance.toString(), "5000000000000"); // 5M tokens
  assert.equal(payerBalance.toString(), "1500000000000"); // 1.5M tokens
  assert.equal(funder3Balance.toString(), "3500000000000"); // 3.5M tokens

  // Create proposal to mint tokens
  const mintAmount = new BN(1_000_000_000000); // 1M tokens
  const receiver = Keypair.generate();
  const receiverAccount = await this.createTokenAccount(
    META,
    receiver.publicKey
  );

  const mintToIx = token.createMintToInstruction(
    META,
    receiverAccount,
    daoTreasury,
    mintAmount.toNumber()
  );

  const instruction = {
    programId: mintToIx.programId,
    data: mintToIx.data,
    accounts: mintToIx.keys,
  };

  // Needs to be 1% of supply
  // and 1% of USDC raised

  const proposal = await this.autocratClient.initializeProposal(
    dao,
    "Mint 1M tokens to receiver",
    instruction,
    PriceMath.getChainAmount(100_000, 6), // 100k tokens
    PriceMath.getChainAmount(100, 6) // 100 USDC
  );

  let {
    passAmm,
    failAmm,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
    baseVault,
    quoteVault,
    passLp,
    failLp,
    question,
  } = this.autocratClient.getProposalPdas(proposal, META, MAINNET_USDC, dao);

  await this.vaultClient
    .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
    .rpc();
  await this.vaultClient
    .splitTokensIx(
      question,
      quoteVault,
      MAINNET_USDC,
      new BN(10_000 * 1_000_000),
      2
    )
    .rpc();

  // swap $500 in the pass market, make it pass
  await this.ammClient
    .swapIx(
      passAmm,
      passBaseMint,
      passQuoteMint,
      { buy: {} },
      new BN(500).muln(1_000_000),
      new BN(0)
    )
    .rpc();

  for (let i = 0; i < 100; i++) {
    await this.advanceBySlots(10_000n);

    await this.ammClient
      .crankThatTwapIx(passAmm)
      .postInstructions([
        // this is to get around bankrun thinking we've processed the same transaction multiple times
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: i,
        }),
        await this.ammClient.crankThatTwapIx(failAmm).instruction(),
      ])
      .signers([this.payer])
      .rpc({ skipPreflight: true });
  }

  await this.autocratClient.finalizeProposal(proposal);

  const storedProposal = await this.autocratClient.getProposal(proposal);

  assert.exists(storedProposal.state.passed);

  await this.autocratClient.executeProposal(proposal);

  const storedMeta = await this.getMint(META);

  assert.equal(storedMeta.supply, 12_000_000 * 10 ** 6);

  const receiverBalance = await this.getTokenBalance(META, receiver.publicKey);

  assert.equal(receiverBalance.toString(), "1000000000000");
}
