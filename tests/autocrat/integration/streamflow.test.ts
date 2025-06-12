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
    [EXECUTION_RECORD_PREFIX, order.toBuffer(), executor.toBuffer(), new anchor.BN(nonce).toArrayLike(Buffer, 'le', 4)],
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
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  META = await createMint(
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

  await this.createTokenAccount(META, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);

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

  const orderKey = deriveOrderPDA(STREAMFLOW_ESCROW_PROGRAM_ID, authority, META, orderNonce);
  const vaultKey = token.getAssociatedTokenAddressSync(META, orderKey, true);

  

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
      baseMint: META,
      quoteMint: USDC,
      order: orderKey,
      vault: vaultKey,
      from: token.getAssociatedTokenAddressSync(META, authority),
      executor: null,
      partner: null,
    })
    .rpc();



  // let dao = await autocratClient.initializeDao(META, 400, 5, 5000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));
  // console.log(dao);
}

