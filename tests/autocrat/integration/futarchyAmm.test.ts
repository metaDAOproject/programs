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
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getEventAuthorityAddr } from "@metadaoproject/futarchy/v0.4";

export default function suite() {
  it.only("futarchy amm", async function () {
    const META = await this.createMint(this.payer.publicKey, 9);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 1000_00_00000 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      1_000_000_000 * 1_000_000
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

    let [futarchyAmm] = PublicKey.findProgramAddressSync([Buffer.from("futarchy_amm")], this.autocratClient.getProgramId());

    await this.autocratClient.autocrat.methods.initializeFutarchyAmm({
        quoteTokenAmount: new BN(200 * 1_000_000),
        baseTokenAmount: new BN(200 * 1_000_000),
    }).accounts({
        futarchyAmm,
        createKey: this.payer.publicKey,
        payer: this.payer.publicKey,
        baseMint: META,
        quoteMint: USDC,
        ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        initializer: this.payer.publicKey,
        initializerBaseAccount: getAssociatedTokenAddressSync(META, this.payer.publicKey),
        initializerQuoteAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
      })
      .rpc();

    const storedDao = await this.autocratClient.getDao(dao);

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

    const proposal = await this.autocratClient.initializeProposal(
      dao,
      "",
      squadsProposalPda,
      new BN(1_000_000_000),
      new BN(1_000_000_000)
    );

    let storedFutarchyAmm = (await this.autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm)).state.futarchy;
    console.log("spot", storedFutarchyAmm.spot.baseReserves.toString(), storedFutarchyAmm.spot.quoteReserves.toString());
    console.log("pass", storedFutarchyAmm.pass.baseReserves.toString(), storedFutarchyAmm.pass.quoteReserves.toString());
    console.log("fail", storedFutarchyAmm.fail.baseReserves.toString(), storedFutarchyAmm.fail.quoteReserves.toString());

    await this.autocratClient.autocrat.methods.spotSwap({
        swapType: {sell: {}},
        inputAmount: new BN(1 * 1_000_000),
        minOutputAmount: new BN(0),
    }).accounts({
        futarchyAmm,
        userBaseAccount: getAssociatedTokenAddressSync(META, this.payer.publicKey),
        userQuoteAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
        ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        trader: this.payer.publicKey,
    }).rpc();

    storedFutarchyAmm = (await this.autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm)).state.futarchy;
    console.log("spot", storedFutarchyAmm.spot.baseReserves.toString(), storedFutarchyAmm.spot.quoteReserves.toString());
    console.log("pass", storedFutarchyAmm.pass.baseReserves.toString(), storedFutarchyAmm.pass.quoteReserves.toString());
    console.log("fail", storedFutarchyAmm.fail.baseReserves.toString(), storedFutarchyAmm.fail.quoteReserves.toString());

    const {
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      question,
      baseVault,
      quoteVault,
    } = this.autocratClient.getProposalPdas(proposal, META, USDC, dao);

    await this.vaultClient
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.vaultClient
      .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
      .rpc();

    await this.autocratClient.autocrat.methods.conditionalSwap({
        market: { pass: {} },
        swapType: {buy: {}},
        inputAmount: new BN(10 * 1_000_000),
        minOutputAmount: new BN(0),
    }).accounts({
        futarchyAmm,
        ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
        ammPassQuoteVault: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
        ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
        ammFailQuoteVault: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
        baseVault,
        quoteVault,
        userInputAccount: getAssociatedTokenAddressSync(passQuoteMint, this.payer.publicKey),
        userOutputAccount: getAssociatedTokenAddressSync(passBaseMint, this.payer.publicKey),
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
        passBaseMint,
        failBaseMint,
        passQuoteMint,
        failQuoteMint,
        conditionalVaultProgram: this.autocratClient.vaultClient.vaultProgram.programId,
        vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
        question,
    }).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })]).rpc();

    await this.autocratClient.autocrat.methods.conditionalSwap({
        market: { fail: {} },
        swapType: {sell: {}},
        inputAmount: new BN(20 * 1_000_000),
        minOutputAmount: new BN(0),
    }).accounts({
        futarchyAmm,
        ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
        ammPassQuoteVault: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
        ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
        ammFailQuoteVault: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
        baseVault,
        quoteVault,
        userInputAccount: getAssociatedTokenAddressSync(failBaseMint, this.payer.publicKey),
        userOutputAccount: getAssociatedTokenAddressSync(failQuoteMint, this.payer.publicKey),
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(META, baseVault, true),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(USDC, quoteVault, true),
        passBaseMint,
        failBaseMint,
        passQuoteMint,
        failQuoteMint,
        conditionalVaultProgram: this.autocratClient.vaultClient.vaultProgram.programId,
        vaultEventAuthority: getEventAuthorityAddr(this.vaultClient.vaultProgram.programId)[0],
        question,
    }).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })]).rpc();

    storedFutarchyAmm = (await this.autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm)).state.futarchy;
    console.log("spot", storedFutarchyAmm.spot.baseReserves.toString(), storedFutarchyAmm.spot.quoteReserves.toString());
    console.log("pass", storedFutarchyAmm.pass.baseReserves.toString(), storedFutarchyAmm.pass.quoteReserves.toString());
    console.log("fail", storedFutarchyAmm.fail.baseReserves.toString(), storedFutarchyAmm.fail.quoteReserves.toString());

    await this.autocratClient.autocrat.methods.spotSwap({
        swapType: {sell: {}},
        inputAmount: (new BN(100_000)).muln(1_000_000),
        minOutputAmount: new BN(0),
    }).accounts({
        futarchyAmm,
        userBaseAccount: getAssociatedTokenAddressSync(META, this.payer.publicKey),
        userQuoteAccount: getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
        ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
        trader: this.payer.publicKey,
    }).rpc();

    storedFutarchyAmm = (await this.autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm)).state.futarchy;
    console.log("spot", storedFutarchyAmm.spot.baseReserves.toString(), storedFutarchyAmm.spot.quoteReserves.toString());
    console.log("pass", storedFutarchyAmm.pass.baseReserves.toString(), storedFutarchyAmm.pass.quoteReserves.toString());
    console.log("fail", storedFutarchyAmm.fail.baseReserves.toString(), storedFutarchyAmm.fail.quoteReserves.toString());

    // await this.autocratClient.autocrat.methods.conditionalSwap({
    //     market: { fail: {} },
    //     swapType: { buy: {} },
    //     inputAmount: new BN(2 * 1_000_000),
    //     minOutputAmount: new BN(0),
    // }).accounts({
    //     futarchyAmm,
    //     ammBaseVault: getAssociatedTokenAddressSync(META, futarchyAmm, true),
    //     ammQuoteVault: getAssociatedTokenAddressSync(USDC, futarchyAmm, true),
    //     ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
    //     ammPassQuoteVault: getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
    //     ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
    //     ammFailQuoteVault: getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
    //     baseVault,
    //     quoteVault,
    // }).rpc();

    // storedFutarchyAmm = (await this.autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm)).state.futarchy;
    // console.log("spot", storedFutarchyAmm.spot.baseReserves.toString(), storedFutarchyAmm.spot.quoteReserves.toString());
    // console.log("pass", storedFutarchyAmm.pass.baseReserves.toString(), storedFutarchyAmm.pass.quoteReserves.toString());
    // console.log("fail", storedFutarchyAmm.fail.baseReserves.toString(), storedFutarchyAmm.fail.quoteReserves.toString());







    return;

    

    // // swap $500 in the pass market, make it pass
    // await this.ammClient
    //   .swapIx(
    //     passAmm,
    //     passBaseMint,
    //     passQuoteMint,
    //     { buy: {} },
    //     new BN(10000).muln(1_000_000),
    //     new BN(0)
    //   )
    //   .rpc();
  });
}
