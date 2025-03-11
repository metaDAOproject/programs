import {
  AmmClient,
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

export default async function () {
  let ammClient: AmmClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  ammClient = this.ammClient;
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
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

  let proposal = Keypair.generate().publicKey;
  amm = await ammClient.createAmm(proposal, META, USDC, toBN(DAY_IN_SLOTS), 500);

  // 1. Initialize AMM
  const initialAmm = await ammClient.getAmm(amm);
  assert.isTrue(initialAmm.baseAmount.eqn(0));
  assert.isTrue(initialAmm.quoteAmount.eqn(0));

  // 2. Add initial liquidity
  await ammClient.addLiquidity(amm, 1000, 2);
  const ammAfterInitialLiquidity = await ammClient.getAmm(amm);
  assert.isTrue(ammAfterInitialLiquidity.baseAmount.gt(new BN(0)));
  assert.isTrue(ammAfterInitialLiquidity.quoteAmount.gt(new BN(0)));

  // 3. Perform swaps
  await ammClient.swap(amm, { buy: {} }, 100, 0.1);
  await ammClient.swap(amm, { sell: {} }, 0.1, 50);

  // 4. Add more liquidity
  await ammClient.addLiquidity(amm, 500, 1);

  // 5. Remove some liquidity
  let userLpAccount = token.getAssociatedTokenAddressSync(
    getAmmLpMintAddr(ammClient.program.programId, amm)[0],
    this.payer.publicKey
  );
  let userLpBalance = (await getAccount(this.banksClient, userLpAccount))
    .amount;
  await ammClient
    .removeLiquidityIx(
      amm,
      META,
      USDC,
      new BN(Number(userLpBalance) / 2),
      new BN(0),
      new BN(0)
    )
    .rpc();

  // 6. Perform more swaps
  await ammClient.swap(amm, { buy: {} }, 200, 0.2);
  await ammClient.swap(amm, { sell: {} }, 0.2, 100);

  // 7. Remove all remaining liquidity
  userLpBalance = (await getAccount(this.banksClient, userLpAccount)).amount;
  await ammClient
    .removeLiquidityIx(
      amm,
      META,
      USDC,
      new BN(userLpBalance),
      new BN(0),
      new BN(0)
    )
    .rpc();

  const finalAmm = await ammClient.getAmm(amm);
  assert.isTrue(finalAmm.baseAmount.eqn(0));
  assert.isTrue(finalAmm.quoteAmount.eqn(0));
}
