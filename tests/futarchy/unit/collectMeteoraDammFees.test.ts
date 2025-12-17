import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  FutarchyClient,
  getMetadataAddr,
  LaunchpadClient,
  MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import { deserializeMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { initializeMintWithSeeds } from "../../launchpad/utils.js";
import { createLookupTableForTransaction } from "../../utils.js";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: null,
        launchAuthority: this.payer.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);
  });

  it("collects Meteora DAMM fees successfully after a successful launch", async function () {
    // NOTE - This test shows that fee collections works correctly for a successfully launched DAO.
    // Essentially, this test shows how to integrate fee collection into a script.

    const launchAccount = await launchpadClient.fetchLaunch(launch);

    const dao = await futarchyClient.getDao(launchAccount.dao);

    const squadsMultisigAccount =
      await multisig.accounts.Multisig.fromAccountAddress(
        this.squadsConnection,
        dao.squadsMultisig,
      );

    await futarchyClient
      .collectMeteoraDammFeesIx({
        dao: launchAccount.dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        transactionIndex:
          BigInt(squadsMultisigAccount.transactionIndex.toString()) + 1n,
        meteoraConfig: MAINNET_METEORA_CONFIG,
        admin: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 }),
      ])
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    // Alternatively, use the multisig.rpc.vaultTransactionExecute function
    const vaultTransactionExecuteTx =
      await multisig.transactions.vaultTransactionExecute({
        blockhash: (await this.banksClient.getLatestBlockhash())[0],
        feePayer: this.payer.publicKey,
        multisigPda: dao.squadsMultisig,
        transactionIndex: 1n,
        member: PERMISSIONLESS_ACCOUNT.publicKey,
        connection: this.squadsConnection,
      });

    await this.banksClient.processTransaction(vaultTransactionExecuteTx);

    const squadsMultisigProposal = multisig.getProposalPda({
      multisigPda: dao.squadsMultisig,
      transactionIndex: 1n,
    })[0];

    const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsMultisigProposal,
    );

    assert.isTrue(
      multisig.types.isProposalStatusExecuted(proposalAccount.status),
    );
  });
}
