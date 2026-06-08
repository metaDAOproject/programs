import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.8";
import BN from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;

  const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days

  before(async function () {
    launchpadClient = this.launchpad_v8;
  });

  async function settleViaLut(
    context: any,
    client: LaunchpadClient,
    params: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: PublicKey;
    },
    additionalSigners: Keypair[] = [],
  ) {
    const settleTx = await client
      .settleLaunchTxBuilder({
        launch: params.launch,
        baseMint: params.baseMint,
        launchAuthority: params.launchAuthority,
      })
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, context);

    const message = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const tx = new VersionedTransaction(message);
    tx.sign([context.payer, ...additionalSigners]);

    await context.banksClient.processTransaction(tx);
  }

  async function setupFundCloseApproveSettle(
    context: any,
    client: LaunchpadClient,
    opts: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: Keypair;
      fundAmount: BN;
    },
  ) {
    // Fund
    await client
      .fundIx({
        launch: opts.launch,
        amount: opts.fundAmount,
        payer: context.payer.publicKey,
      })
      .rpc();

    // Advance past launch period
    await context.advanceBySeconds(secondsForLaunch + 1);

    // Close
    await client.closeLaunchIx({ launch: opts.launch }).rpc();

    // Approve
    await client
      .setFundingRecordApprovalIx({
        launch: opts.launch,
        approvedAmount: opts.fundAmount,
        funder: context.payer.publicKey,
        launchAuthority: opts.launchAuthority.publicKey,
      })
      .signers([opts.launchAuthority])
      .rpc();

    // Settle
    await settleViaLut(
      context,
      client,
      {
        launch: opts.launch,
        baseMint: opts.baseMint,
        launchAuthority: opts.launchAuthority.publicKey,
      },
      [opts.launchAuthority],
    );
  }

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    launchAuthority = new Keypair();

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });

    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();
  });

  it("finalizes launch with PP v2 setup and MintGovernor admin transfer to DAO", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6); // 150k USDC

    await setupFundCloseApproveSettle(this, launchpadClient, {
      launch,
      baseMint: META,
      launchAuthority,
      fundAmount,
    });

    // Verify launch is Complete before finalize
    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });
    assert.equal(launchAccount.isFinalized, false);

    // Finalize
    await launchpadClient
      .finalizeLaunchTxBuilder({
        launch,
        baseMint: META,
        performancePackageGrantee: launchAccount.performancePackageGrantee,
      })
      .rpc();

    // Reload launch state
    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(launchAccount.isFinalized, true);

    // Derive expected addresses
    const mintGovernorAddr = launchpadClient.getMintGovernorAddress({
      baseMint: META,
      launchSigner,
    });
    const daoAddr = launchpadClient.getLaunchDaoAddress({ launch });
    const [squadsMultisig] = multisig.getMultisigPda({ createKey: daoAddr });
    const [squadsMultisigVault] = multisig.getVaultPda({
      multisigPda: squadsMultisig,
      index: 0,
    });

    // Verify MintGovernor admin transferred to DAO (squads_multisig_vault)
    const mintGovernorAccount =
      await launchpadClient.mintGovernorClient.fetchMintGovernor(
        mintGovernorAddr,
      );
    assert.ok(mintGovernorAccount.admin.equals(squadsMultisigVault));

    // Verify PP v2 MintAuthority was created for the performance package
    const performancePackageAddr =
      launchpadClient.getLaunchPerformancePackageAddress({ launch });
    const ppMintAuthorityAddr = launchpadClient.getMintAuthorityAddress({
      mintGovernor: mintGovernorAddr,
      authorizedMinter: performancePackageAddr,
    });
    const ppMintAuthorityAccount =
      await launchpadClient.mintGovernorClient.fetchMintAuthority(
        ppMintAuthorityAddr,
      );
    assert.ok(
      ppMintAuthorityAccount.authorizedMinter.equals(performancePackageAddr),
    );
    // max_total = performance_package_token_amount (5M tokens)
    const expectedPPMaxTotal = new BN(5_000_000 * 10 ** 6);
    assert.equal(
      ppMintAuthorityAccount.maxTotal.toString(),
      expectedPPMaxTotal.toString(),
    );

    // Verify PP v2 account was initialized
    const ppAccount =
      await launchpadClient.performancePackageV2.fetchPerformancePackage(
        performancePackageAddr,
      );
    assert.isNotNull(ppAccount);

    // PP authority should be squads_multisig_vault (DAO controls it)
    assert.ok(ppAccount.authority.equals(squadsMultisigVault));

    // PP recipient should be the performance_package_grantee
    assert.ok(
      ppAccount.recipient.equals(launchAccount.performancePackageGrantee),
    );

    // Verify DAO MintAuthority was created for the squads_multisig_vault
    const daoMintAuthorityAddr = launchpadClient.getMintAuthorityAddress({
      mintGovernor: mintGovernorAddr,
      authorizedMinter: squadsMultisigVault,
    });
    const daoMintAuthorityAccount =
      await launchpadClient.mintGovernorClient.fetchMintAuthority(
        daoMintAuthorityAddr,
      );
    assert.ok(
      daoMintAuthorityAccount.authorizedMinter.equals(squadsMultisigVault),
    );
    assert.isNull(daoMintAuthorityAccount.maxTotal);
  });

  it("fails when launch state is not Complete", async function () {
    // Launch is in Live state — don't fund/close/settle
    // The DAO constraint fires before validate() since launch.dao is None
    try {
      await launchpadClient
        .finalizeLaunchTxBuilder({
          launch,
          baseMint: META,
          performancePackageGrantee: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidDao");
    }
  });

  it("can finalize only once", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6);

    await setupFundCloseApproveSettle(this, launchpadClient, {
      launch,
      baseMint: META,
      launchAuthority,
      fundAmount,
    });

    const launchAccount = await launchpadClient.fetchLaunch(launch);

    // First finalize succeeds
    await launchpadClient
      .finalizeLaunchTxBuilder({
        launch,
        baseMint: META,
        performancePackageGrantee: launchAccount.performancePackageGrantee,
      })
      .rpc();

    // Second finalize fails
    try {
      await launchpadClient
        .finalizeLaunchTxBuilder({
          launch,
          baseMint: META,
          performancePackageGrantee: launchAccount.performancePackageGrantee,
        })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "PerformancePackageAlreadyInitialized");
    }
  });
}
