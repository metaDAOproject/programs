import { AUTOCRAT_PROGRAM_ID, AutocratClient, getDaoAddr, getProposalAddr, InstructionUtils } from "@metadaoproject/futarchy/v0.5";
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
// import { getFutarchyAmmAddr } from "@metadaoproject/futarchy/v0.5";
import { sha256 } from "@metadaoproject/futarchy";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getEventAuthorityAddr } from "@metadaoproject/futarchy/v0.5";
import { Program } from "@coral-xyz/anchor";

// import { readFileSync } from 'fs';
// import { dirname, join } from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
const IDL = (await import("../../../target/idl/autocrat.json", { assert: { type: "json" } })).default;

export const getFutarchyAmmAddr = ({
  programId = AUTOCRAT_PROGRAM_ID,
}: {
  programId?: PublicKey;
}): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("futarchy_amm")],
    programId
  );
};

export default function suite() {
  it("should enable creation, passing, and execution of a proposal", async function () {
    const program = new Program(IDL, this.autocratClient.provider);

    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100_000_000 * 10 ** 6);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000_000 * 1_000_000
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

    await program.methods
      .initializeFutarchyAmm({
        quoteAmount: new BN(5_000_000).mul(new BN(10 ** 6)),
        baseAmount: new BN(5_000_000).mul(new BN(10 ** 6)),
      })
      .accounts({
        payer: this.payer.publicKey,
        creator: this.payer.publicKey,
        dao,
        baseMint: META,
        quoteMint: USDC,
        creatorBaseAccount: getAssociatedTokenAddressSync(META, this.payer.publicKey),
        creatorQuoteAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
      })
      .rpc();


    // await this.autocratClient.initializeFutarchyAmmIx({
    //   quoteAmount: new BN(500_000).mul(new BN(10 ** 6)),
    //   baseAmount: new BN(500_000).mul(new BN(10 ** 6)),
    //   dao,
    //   baseMint: META,
    //   quoteMint: USDC,
    // }).rpc();

    // let storedAmm = await this.autocratClient.getAmm(getFutarchyAmmAddr({})[0]);

    // console.log(storedAmm.spotPool.quoteReserves.toString());
    // console.log(storedAmm.spotPool.baseReserves.toString());

    // await this.autocratClient.swapIx({
    //   amountIn: new BN(1).mul(new BN(10 ** 6)),
    //   side: {buy: {}},
    //   baseMint: META,
    //   quoteMint: USDC,
    // }).rpc();

    // storedAmm = await this.autocratClient.getAmm(getFutarchyAmmAddr({})[0]);
    // console.log(storedAmm.spotPool.quoteReserves.toString());
    // console.log(storedAmm.spotPool.baseReserves.toString());

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
      squadsProposalPda
    );

    await this.vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    const {
      baseVault,
      quoteVault,
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

    // let futarchyAmm = getFutarchyAmmAddr({})[0];

    const futarchyAmm = getFutarchyAmmAddr({})[0];
    
    await program.methods.initializeProposal({
      nonce: proposalNonce,
    })
    .accounts({
      question,
      dao,
      squadsProposal: squadsProposalPda,
      futarchyAmm,
      ammTokenAccounts: {
        futarchyAmm,
        baseVault,
        quoteVault,
        unconditionalBase: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        unconditionalQuote: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        passBase: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
        passQuote: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
        failBase: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
        failQuote: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
      },
      baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
      quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
      passBaseMint: passBaseMint,
      failBaseMint: failBaseMint,
      passQuoteMint: passQuoteMint,
      failQuoteMint: failQuoteMint,
      baseMint: META,
      quoteMint: USDC,
      conditionalVaultProgram: this.vaultClient.vaultProgram.programId,
      vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
      tokenProgram: TOKEN_PROGRAM_ID,
    }) 
    .preInstructions([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      createAssociatedTokenAccountIdempotentInstruction(this.payer.publicKey, getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true), futarchyAmm, passBaseMint),
      createAssociatedTokenAccountIdempotentInstruction(this.payer.publicKey, getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true), futarchyAmm, passQuoteMint),
      createAssociatedTokenAccountIdempotentInstruction(this.payer.publicKey, getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true), futarchyAmm, failBaseMint),
      createAssociatedTokenAccountIdempotentInstruction(this.payer.publicKey, getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true), futarchyAmm, failQuoteMint),
    ])
    .rpc();

    let storedAmm = await program.account.amm.fetch(futarchyAmm);
    // console.log(storedAmm.spotPool.quoteReserves.toString());
    // console.log(storedAmm.spotPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

    await program.methods.spotSwap({
      side: {sell: {}},
      amountIn: new BN(3).mul(new BN(10 ** 6)),
      minAmountOut: new BN(990_009),
    })
    .accounts({
        futarchyAmm,
        trader: this.payer.publicKey,
        traderInputAccount: getAssociatedTokenAddressSync(META, this.payer.publicKey),
        traderOutputAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
        baseVault: baseVault,
        quoteVault: quoteVault,
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
        baseMint: META,
        quoteMint: USDC,
        passQuoteMint: passQuoteMint,
        failQuoteMint: failQuoteMint,
        passBaseMint: passBaseMint,
        failBaseMint: failBaseMint,
        ammTokenAccounts: {
          unconditionalBase: getAssociatedTokenAddressSync(META, futarchyAmm, true),
          unconditionalQuote: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
          passBase: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
          passQuote: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
          failBase: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
          failQuote: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
          baseVault,
          quoteVault,
          futarchyAmm,
        },
        question: question,
        vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        conditionalVaultProgram: this.vaultClient.vaultProgram.programId,
    })
    .preInstructions([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ])
    // .remainingAccounts([
    //   {
    //     pubkey: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
    //     isWritable: true,
    //     isSigner: false,
    //   },
    // ])
    .rpc();


    await this.vaultClient
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    await this.vaultClient
      .splitTokensIx(question, baseVault, META, new BN(100), 2)
      .rpc();


    // storedAmm = await this.autocratClient.getAmm(futarchyAmm);
    // console.log(storedAmm.spotPool.quoteReserves.toString());
    // console.log(storedAmm.spotPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

    await program.methods.conditionalTrade({
      side: {buy: {}},
      condition: {pass: {}},
      amountIn: new BN(1_000).mul(new BN(10 ** 6)),
      minAmountOut: new BN(990_009),
    })
    .accounts({
        futarchyAmm,
        trader: this.payer.publicKey,
        traderInputAccount: getAssociatedTokenAddressSync(passQuoteMint, this.payer.publicKey),
        traderOutputAccount: getAssociatedTokenAddressSync(passBaseMint, this.payer.publicKey),
        baseVault: baseVault,
        quoteVault: quoteVault,
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
        baseMint: META,
        quoteMint: USDC,
        passQuoteMint: passQuoteMint,
        failQuoteMint: failQuoteMint,
        passBaseMint: passBaseMint,
        failBaseMint: failBaseMint,
        ammTokenAccounts: {
          unconditionalBase: getAssociatedTokenAddressSync(META, futarchyAmm, true),
          unconditionalQuote: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
          passBase: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
          passQuote: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
          failBase: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
          failQuote: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
          baseVault,
          quoteVault,
          futarchyAmm,
        },
        question: question,
        vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        conditionalVaultProgram: this.vaultClient.vaultProgram.programId,
    })
    .preInstructions([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 }),
    ])
    .rpc();

    // storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    // console.log(storedAmm.spotPool.quoteReserves.toString());
    // console.log(storedAmm.spotPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    // console.log(storedAmm.liveProposal.failPool.baseReserves.toString());


    await program.methods.predictionSwap({
      side: {buy: {}},
      underlyingAsset: {quote: {}},
      condition: {pass: {}},
      amountIn: new BN(100_000),
      minAmountOut: new BN(990_009),
    })
    .accounts({
      futarchyAmm,
      trader: this.payer.publicKey,
      traderInputAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
      traderOutputAccount: getAssociatedTokenAddressSync(passQuoteMint, this.payer.publicKey),
      baseVault: baseVault,
      quoteVault: quoteVault,
      baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
      quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
      baseMint: META,
      quoteMint: USDC,
      passQuoteMint: passQuoteMint,
      failQuoteMint: failQuoteMint,
      passBaseMint: passBaseMint,
      failBaseMint: failBaseMint,
      ammTokenAccounts: {
        unconditionalBase: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        unconditionalQuote: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        passBase: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
        passQuote: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
        failBase: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
        failQuote: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
        baseVault,
        quoteVault,
        futarchyAmm,
      },
      question: question,
      vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
      tokenProgram: TOKEN_PROGRAM_ID,
      conditionalVaultProgram: this.vaultClient.vaultProgram.programId,
    })
    .preInstructions([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ])
    .rpc();

    return;

    // await this.autocratClient.conditionalSwapIx({
    //   amountIn: new BN(1).mul(new BN(10 ** 6)),
    //   side: {sell: {}},
    //   condition: {pass: {}},
    //   baseMint: META,
    //   quoteMint: USDC,
    // }).rpc();

    storedAmm = await this.autocratClient.getFutarchyAmm(getFutarchyAmmAddr({})[0]);
    console.log(storedAmm.spotPool.quoteReserves.toString());
    console.log(storedAmm.spotPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.passPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.passPool.baseReserves.toString());
    console.log(storedAmm.liveProposal.failPool.quoteReserves.toString());
    console.log(storedAmm.liveProposal.failPool.baseReserves.toString());

  });
}
