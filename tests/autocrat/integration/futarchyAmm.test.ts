import { AutocratClient, getDaoAddr, getProposalAddr, InstructionUtils } from "@metadaoproject/futarchy/v0.5";
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
import { getFutarchyAmmAddr } from "@metadaoproject/futarchy/v0.5";
import { sha256 } from "@metadaoproject/futarchy";

export default function suite() {
  it("should enable creation, passing, and execution of a proposal", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 1_000 * 10 ** 6);
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

    await this.autocratClient
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

    const storedDao = await this.autocratClient.getDao(dao);

    await this.autocratClient.initializeFutarchyAmmIx({
      quoteAmount: new BN(100).mul(new BN(10 ** 6)),
      baseAmount: new BN(100).mul(new BN(10 ** 6)),
      dao,
      baseMint: META,
      quoteMint: USDC,
    }).rpc();

    let storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);

    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());

    await this.autocratClient.swapIx({
      amountIn: new BN(1).mul(new BN(10 ** 6)),
      side: {buy: {}},
      baseMint: META,
      quoteMint: USDC,
    }).rpc();

    storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    const updateDaoIx = await this.autocratClient
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

    const proposalNonce = new BN(Math.random() * 2 ** 50);

    let [proposal] = getProposalAddr(
      this.autocratClient.getProgramId(),
      this.payer.publicKey,
      proposalNonce
    );


    await this.vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      question,
    } = this.autocratClient.getProposalPdas(
      proposal,
      META,
      USDC,
      dao
    );

    // it's important that these happen in a single atomic transaction
    await this.vaultClient
      .initializeVaultIx(question, storedDao.baseMint, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.initializeVaultIx(question, storedDao.quoteMint, 2),
        )
      )
      .rpc();
    
    await this.autocratClient.initializeProposalIx({
      nonce: proposalNonce,
      dao,
      baseMint: META,
      quoteMint: USDC,
      question,
      squadsProposal: squadsProposalPda,
    }).rpc();

    storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

    await this.autocratClient.swapIx({
      amountIn: new BN(1).mul(new BN(10 ** 6)),
      side: {buy: {}},
      baseMint: META,
      quoteMint: USDC,
    }).rpc();

    storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

    await this.autocratClient.conditionalSwapIx({
      amountIn: new BN(1).mul(new BN(10 ** 6)),
      side: {sell: {}},
      condition: {pass: {}},
      baseMint: META,
      quoteMint: USDC,
    }).rpc();

    storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

  });
}
