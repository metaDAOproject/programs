import { AutocratClient, getDaoAddr } from "@metadaoproject/futarchy/v0.5";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";
import { ONE_MINUTE_IN_SLOTS } from "../../utils.js";
import { AccountInfo } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";

export default function suite() {
  it("should enable creation, passing, and execution of a proposal", async function () {
    const META = await this.createMint(this.payer.publicKey, 9);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 1_000_000
    );

    const nonce = new BN(Math.random() * 2 ** 50);

    const [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          nonce,
          twapStartDelaySlots: new BN(0),
          twapInitialObservation: new BN(0),
          twapMaxObservationChangePerUpdate: new BN("1000000000000000000"),
          minQuoteFutarchicLiquidity: new BN(0),
          slotsPerProposal: new BN(
            (ONE_MINUTE_IN_SLOTS * 60n * 24n).toString()
          ),
          passThresholdBps: 300,
          minBaseFutarchicLiquidity: new BN(0),
          initialSpendingLimit: null,
        },
      })
      .rpc();

    const storedDao = await this.futarchy.getDao(dao);

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    const tx0 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: vaultPda,
        lamports: 1_000_000_000,
      })
    );
    tx0.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx0.feePayer = this.payer.publicKey;
    tx0.sign(this.payer);

    await this.banksClient.processTransaction(tx0);

    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          slotsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    const tx2 = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx2.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx2.feePayer = this.payer.publicKey;
    tx2.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx2);

    const proposal = await this.futarchy.initializeProposal(
      dao,
      "",
      squadsProposalPda,
      new BN(1_000_000_000),
      new BN(1_000_000_000)
    );

    const {
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      question,
      baseVault,
      quoteVault,
    } = this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    // swap $500 in the pass market, make it pass
    await this.ammClient
      .swapIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        { buy: {} },
        new BN(10000).muln(1_000_000),
        new BN(0)
      )
      .rpc();

    for (let i = 0; i < 100; i++) {
      await this.advanceBySlots(20_000n);

      await this.ammClient
        .crankThatTwapIx(passAmm)
        .preInstructions([
          // this is to get around bankrun thinking we've processed the same transaction multiple times
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: i,
          }),
          await this.ammClient.crankThatTwapIx(failAmm).instruction(),
        ])
        .rpc();
    }

    await this.futarchy.finalizeProposal(proposal);

    const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda,
      transactionIndex: 1n,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    const txExecute = new Transaction().add(txExecuteIx.instruction);
    txExecute.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    txExecute.feePayer = this.payer.publicKey;
    txExecute.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(txExecute);

    const storedDao2 = await this.futarchy.getDao(dao);
    console.log("post update", storedDao2.passThresholdBps);
  });
}
