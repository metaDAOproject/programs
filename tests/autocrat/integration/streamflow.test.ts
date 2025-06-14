import {
  AmmClient,
  AutocratClient,
  getAmmAddr,
  getAmmLpMintAddr,
} from "@metadaoproject/futarchy/v0.4";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError, toBN } from "../../utils.js";
import { BN } from "bn.js";

import { StreamflowEscrow, IDL as StreamflowEscrowIDL } from "../../fixtures/streamflow_escrow.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { STREAMFLOW_VESTING_PROGRAM_ID } from "../../main.test.js";
// import { IDL as StreamflowEscrowIDL } from "../../fixtures/streamflow_escrow.json";


export const ORDER_PREFIX = Buffer.from('order', 'utf-8');
export const EXECUTION_RECORD_PREFIX = Buffer.from('execution-record', 'utf-8');
export const ESCROW_PREFIX = Buffer.from('strm', 'utf-8');

export const deriveOrderPDA = (
  programId: anchor.web3.PublicKey,
  creator: anchor.web3.PublicKey,
  baseMint: anchor.web3.PublicKey,
  nonce: number,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [ORDER_PREFIX, creator.toBuffer(), baseMint.toBuffer(), new BN(nonce).toArrayLike(Buffer, 'le', 4)],
    programId,
  )[0];
};

export const deriveExecutionRecordPDA = (
  programId: anchor.web3.PublicKey,
  order: anchor.web3.PublicKey,
  executor: anchor.web3.PublicKey,
  nonce: number,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [EXECUTION_RECORD_PREFIX, order.toBuffer(), executor.toBuffer(), new BN(nonce).toArrayLike(Buffer, 'le', 4)],
    programId,
  )[0];
};

export const deriveEscrowPDA = (
  programId: anchor.web3.PublicKey,
  contractKey: anchor.web3.PublicKey,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync([ESCROW_PREFIX, contractKey.toBuffer()], programId)[0];
};


export default async function() {
  let ammClient: AmmClient;
  let autocratClient: AutocratClient;
  let RAY: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  RAY = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    9
  );
  USDC = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    6
  );

  await this.createTokenAccount(RAY, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(RAY, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000000 * 10 ** 6);

  autocratClient = this.autocratClient;
  ammClient = this.ammClient;

  const STREAMFLOW_ESCROW_PROGRAM_ID = new PublicKey("ESCRoWj8QUJ5cTXCBWbGpW6AzaaEAtRbZuwKp8c4YYGs");
  const escrow = new anchor.Program(StreamflowEscrowIDL as anchor.Idl, STREAMFLOW_ESCROW_PROGRAM_ID);

  const authority = this.payer.publicKey;
  // const baseMint = new PublicKey(baseAddr);
  // const quoteMint = new PublicKey(quoteAddr);
  const amount = new BN(1000000);
  const price = new BN(5000000);
  const orderNonce = 0;
  const vestingStartTs = new BN(Math.floor(Date.now() / 1000) + 3600);
  const vestingPeriod = new BN(30);
  const vestingAmountPerPeriod = new BN(1);
  const vestingCliffAmount = new BN(500000);

  const orderKey = deriveOrderPDA(STREAMFLOW_ESCROW_PROGRAM_ID, authority, RAY, orderNonce);
  const vaultKey = token.getAssociatedTokenAddressSync(RAY, orderKey, true);

  // const treasury = Keypair.generate();

  // // Send 1 SOL to treasury
  // const tx = new anchor.web3.Transaction();
  // tx.add(
  //   anchor.web3.SystemProgram.transfer({
  //     fromPubkey: this.payer.publicKey,
  //     toPubkey: treasury.publicKey,
  //     lamports: 1_000_000_000, // 1 SOL = 1 billion lamports
  //   })
  // );
  // tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // console.log('recentBlockhash', tx.recentBlockhash);
  // tx.feePayer = this.payer.publicKey;
  // tx.sign(this.payer);
  // await this.banksClient.processTransaction(tx);

  console.log('Creating vested order:', orderKey.toBase58());
  await escrow.methods
    .createOrderFixed({
      nonce: orderNonce,
      amount,
      startPrice: price,
      partialAllowed: false,
      expiryTs: new BN(0),
      claimType: { vested: {} },
      vestingStartTs,
      vestingPeriod,
      vestingAmountPerPeriod,
      vestingCliffAmount,
    })
    .accounts({
      creator: authority,
      baseMint: RAY,
      quoteMint: USDC,
      order: orderKey,
      vault: vaultKey,
      from: token.getAssociatedTokenAddressSync(RAY, authority),
      executor: null,
      partner: null,
    })
    .rpc();

    const fillNonce = 0;

  // await this.createTokenAccount(RAY, treasury.publicKey);
  // await this.createTokenAccount(USDC, treasury.publicKey);
  // await this.mintTo(USDC, treasury.publicKey, this.payer, 1000000 * 10 ** 6);

  const contractKeypair = Keypair.generate();
  const contractKey = contractKeypair.publicKey;
  const escrowKey = deriveEscrowPDA(STREAMFLOW_ESCROW_PROGRAM_ID, contractKey);
  const recordKey = deriveExecutionRecordPDA(STREAMFLOW_ESCROW_PROGRAM_ID, orderKey, authority, fillNonce);

  console.log('Filling order vested:', recordKey.toBase58());
  await escrow.methods
    .fillOrderVested(fillNonce, amount, price, false)
    .accounts({
      common: {
        executor: authority,
        from: token.getAssociatedTokenAddressSync(USDC, authority),
        toBase: token.getAssociatedTokenAddressSync(RAY, authority),
        order: orderKey,
        toQuote: token.getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
        baseTokenProgram: token.TOKEN_PROGRAM_ID,
        quotaTokenProgram: token.TOKEN_PROGRAM_ID,
        vault: vaultKey,
        creator: authority,
        baseMint: RAY,
        quoteMint: USDC,
      },
      streamMetadata: contractKey,
      withdrawor: new PublicKey("wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u"),
      feeOracle: new PublicKey("B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT"),
      escrowTokens: escrowKey,
    })
    .accounts({ executionRecord: recordKey, streamflowProgram: STREAMFLOW_VESTING_PROGRAM_ID })
    .signers([contractKeypair])
    .rpc();



  // let dao = await autocratClient.initializeDao(META, 400, 5, 5000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));
  // console.log(dao);
}

