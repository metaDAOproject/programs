import {
  getDaoAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import BN from "bn.js";
import { ONE_MINUTE_IN_SLOTS } from "../../utils.js";
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
      100_000 * 1_000_000
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    // Initialize a DAO first
    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          slotsPerProposal: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24 * 3),
          twapStartDelaySlots: new BN(ONE_MINUTE_IN_SLOTS).muln(60 * 24),
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1000),
          passThresholdBps: 300,
          baseToStake: new BN(1000),
          nonce,
          initialSpendingLimit: null, 
        },
      })
      .rpc();

    [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });
  });

  it("should initialize a proposal", async function () {
    const descriptionUrl = "https://example.com/proposal";
    const baseTokensToLP = new BN(10 * 10 ** 9); // 10 META
    const quoteTokensToLP = new BN(5000 * 10 ** 6); // 5000 USDC

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          slotsPerProposal: null,
          baseToStake: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
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

    // Now initialize the autocrat proposal
    const proposal = await this.futarchy.initializeProposal(
      dao,
      descriptionUrl,
      squadsProposalPda,
      baseTokensToLP,
      quoteTokensToLP
    );

    // Split tokens into the vaults (as in the integration test)
    const { baseVault, quoteVault, question } =
      this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.descriptionUrl, descriptionUrl);
    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposalPda));
    assert.exists(storedProposal.state.draft);

    // Verify the DAO proposal count was incremented
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.proposalCount, 1);
  });
}
