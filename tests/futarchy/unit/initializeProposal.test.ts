import {
  getDaoAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  addLookupsToVaultTransaction,
  expectError,
  setLookupTableAccount,
  setOptimisticGovernanceEnabled,
} from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    // Mint tokens to payer's accounts
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 1_000_000,
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(10_000),
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

    await setOptimisticGovernanceEnabled(this, dao, true);
  });

  async function createSquadsProposal(
    context: any,
    daoKey: PublicKey,
  ): Promise<{ squadsProposal: PublicKey; squadsVaultTransaction: PublicKey }> {
    const multisigPda = multisig.getMultisigPda({ createKey: daoKey })[0];

    const transactionMessage = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: [
        SystemProgram.transfer({
          fromPubkey: context.payer.publicKey,
          toPubkey: context.payer.publicKey,
          lamports: 1,
        }),
      ],
    });

    const tx = new Transaction().add(
      multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: context.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage,
      }),
      multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: context.payer.publicKey,
      }),
    );

    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);

    await context.banksClient.processTransaction(tx);

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });
    const [squadsVaultTransaction] = multisig.getTransactionPda({
      multisigPda,
      index: 1n,
    });

    return { squadsProposal, squadsVaultTransaction };
  }

  it("should initialize a proposal", async function () {
    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          baseToStake: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          twapStartDelaySeconds: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          isOptimisticGovernanceEnabled: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda: multisig.getMultisigPda({ createKey: dao })[0],
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: multisig.getMultisigPda({ createKey: dao })[0],
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: multisig.getMultisigPda({ createKey: dao })[0],
      transactionIndex: 1n,
    });

    // Create the squads proposal first
    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    // Now initialize the futarchy proposal
    const proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposalPda,
    );

    // Split tokens into the vaults (as in the integration test)
    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposalPda));
    assert.exists(storedProposal.state.draft);

    // Verify the DAO proposal count was incremented
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.proposalCount, 1);
  });

  it("doesn't allow challenging an optimistic proposal which has already passed due to age", async function () {
    let daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(USDC, daoAccount.squadsMultisigVault);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
        quoteMint: USDC,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    daoAccount = await this.futarchy.getDao(dao);

    this.advanceBySeconds(daoAccount.secondsPerProposal);

    const callbacks = expectError(
      "OptimisticProposalAlreadyPassed",
      "Optimistic proposal has already passed",
    );

    await this.futarchy
      .initializeProposal(dao, daoAccount.optimisticProposal.squadsProposal)
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a vault transaction referencing an unfrozen lookup table", async function () {
    const { squadsProposal, squadsVaultTransaction } =
      await createSquadsProposal(this, dao);

    const lookupTable = Keypair.generate().publicKey;
    setLookupTableAccount(this, lookupTable, this.payer.publicKey, [
      Keypair.generate().publicKey,
    ]);
    await addLookupsToVaultTransaction(this, squadsVaultTransaction, [
      { accountKey: lookupTable, writableIndexes: [0], readonlyIndexes: [] },
    ]);

    const callbacks = expectError(
      "UnfrozenAddressLookupTable",
      "initialize_proposal accepted an unfrozen lookup table",
    );

    await this.futarchy
      .initializeProposal(dao, squadsProposal)
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a frozen lookup table when the message references an index that doesn't exist", async function () {
    const { squadsProposal, squadsVaultTransaction } =
      await createSquadsProposal(this, dao);

    const lookupTable = Keypair.generate().publicKey;
    setLookupTableAccount(this, lookupTable, null, [
      Keypair.generate().publicKey,
    ]);
    await addLookupsToVaultTransaction(this, squadsVaultTransaction, [
      { accountKey: lookupTable, writableIndexes: [0], readonlyIndexes: [5] },
    ]);

    const callbacks = expectError(
      "InvalidTransaction",
      "initialize_proposal accepted a lookup index that is out of range",
    );

    await this.futarchy
      .initializeProposal(dao, squadsProposal)
      .then(callbacks[0], callbacks[1]);
  });
}
