import {
  getProposalAddrV2,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.7";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { getDaoAddr, MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import * as squads from "@sqds/multisig";
import { mintToOverride } from "spl-token-bankrun";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey,
    dao: PublicKey,
    spendingLimit: BN,
    transferAmount: bigint;
  let setOptimisticGovernanceEnabled: (
    dao: PublicKey,
    enabled: boolean,
  ) => Promise<void>;

  beforeEach(async function () {
    setOptimisticGovernanceEnabled = async (
      dao: PublicKey,
      enabled: boolean,
    ) => {
      const daoAccount = await this.futarchy.getDao(dao);
      daoAccount.isOptimisticGovernanceEnabled = enabled;
      const daoAccountBuffer =
        await this.futarchy.autocrat.account.dao.coder.accounts.encode(
          "dao",
          daoAccount,
        );

      const daoBanksAccount = await this.banksClient.getAccount(dao);
      daoBanksAccount.data.set(daoAccountBuffer, 0);
      this.context.setAccount(dao, daoBanksAccount);
    };
    META = await this.createMint(this.payer.publicKey, 9);
    spendingLimit = new BN(10_000);
    transferAmount = 1000n;
    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);

    // Mint tokens to payer's accounts
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: MAINNET_USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(0),
          minBaseFutarchicLiquidity: new BN(0),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: spendingLimit,
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 0,
          teamAddress: this.payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    const daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(MAINNET_USDC, daoAccount.squadsMultisigVault);

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      daoAccount.squadsMultisigVault,
      100_000 * 1_000_000,
    );

    // Mint an extra 1M META tokens to the payer's account for staking to proposals
    await mintToOverride(
      this.context,
      getAssociatedTokenAddressSync(META, this.payer.publicKey),
      1_000_000n * 10n ** 6n,
    );
  });

  it("can challenge an optimistic proposal by launching a new futarchy proposal using the same squads proposal", async function () {
    await setOptimisticGovernanceEnabled(dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(transferAmount),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    let daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const [squadsProposal] = squads.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    await this.futarchy.initializeProposal(dao, squadsProposal);

    const [proposal] = getProposalAddrV2({ squadsProposal });

    await this.futarchy
      .stakeToProposalIx({
        amount: new BN(1_000_000 * 10 ** 6),
        proposal,
        dao,
        baseMint: META,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
      })
      .rpc();

    // Assert that the optimistic proposal has been migrated to the futarchy proposal
    daoAccount = await this.futarchy.getDao(dao);
    assert.notExists(daoAccount.optimisticProposal);

    const proposalAccount = await this.futarchy.getProposal(proposal);
    assert.exists(proposalAccount.state.pending);
    assert.equal(
      proposalAccount.squadsProposal.toBase58(),
      squadsProposal.toBase58(),
    );
  });

  it("can't challenge an optimistic proposal if it has already passed due to age", async function () {
    await setOptimisticGovernanceEnabled(dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(transferAmount),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    let daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const [squadsProposal] = squads.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    // Initialize the futarchy proposal before the optimistic proposal is auto-approved
    await this.futarchy.initializeProposal(dao, squadsProposal);

    this.advanceBySeconds(daoAccount.secondsPerProposal);

    const [proposal] = getProposalAddrV2({ squadsProposal });

    await this.futarchy
      .stakeToProposalIx({
        amount: new BN(1_000_000 * 10 ** 6),
        proposal,
        dao,
        baseMint: META,
      })
      .rpc();

    const callbacks = expectError(
      "OptimisticProposalAlreadyPassed",
      "Optimistic proposal has already passed",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
