import {
  AmmClient,
  getAmmAddr,
  getAmmLpMintAddr,
} from "@metadaoproject/futarchy";
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
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "bn.js";

export default function suite() {
  let ammClient: AmmClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  beforeEach(async function () {
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

    await ammClient.addLiquidity(amm, 1000, 2);
  });

  it("can't remove 0 liquidity", async function () {
    const callbacks = expectError(
      "ZeroLiquidityRemove",
      "was able to remove 0 liquidity"
    );

    await ammClient
      .removeLiquidityIx(amm, META, USDC, new BN(0), new BN(0), new BN(0))
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("remove some liquidity from an amm position", async function () {
    const ammStart = await ammClient.getAmm(amm);

    let userLpAccount = getAssociatedTokenAddressSync(
      ammStart.lpMint,
      this.payer.publicKey
    );

    const userLpAccountStart = await getAccount(
      this.banksClient,
      userLpAccount
    );
    const lpMintStart = await getMint(this.banksClient, ammStart.lpMint);

    await ammClient
      .removeLiquidityIx(
        amm,
        META,
        USDC,
        new BN(userLpAccountStart.amount.toString()).divn(2),
        new BN(0),
        new BN(0)
      )
      .rpc();

    const userLpAccountEnd = await getAccount(this.banksClient, userLpAccount);
    const lpMintEnd = await getMint(this.banksClient, ammStart.lpMint);

    const ammEnd = await ammClient.getAmm(amm);

    assert.equal(ammEnd.seqNum.toString(), "2");

    assert.isBelow(Number(lpMintEnd.supply), Number(lpMintStart.supply));
    assert.isBelow(
      Number(userLpAccountEnd.amount),
      Number(userLpAccountStart.amount)
    );

    assert.isBelow(
      ammEnd.baseAmount.toNumber(),
      ammStart.baseAmount.toNumber()
    );
    assert.isBelow(
      ammEnd.quoteAmount.toNumber(),
      ammStart.quoteAmount.toNumber()
    );
  });

  it("remove all liquidity from an amm position", async function () {
    const ammStart = await ammClient.getAmm(amm);

    let userLpAccount = getAssociatedTokenAddressSync(
      ammStart.lpMint,
      this.payer.publicKey
    );

    const userLpAccountStart = await getAccount(
      this.banksClient,
      userLpAccount
    );
    const lpMintStart = await getMint(this.banksClient, ammStart.lpMint);

    await ammClient
      .removeLiquidityIx(
        amm,
        META,
        USDC,
        new BN(userLpAccountStart.amount.toString()),
        new BN(1 * 10 ** 9),
        new BN(10 * 10 ** 6)
      )
      .rpc();

    const userLpAccountEnd = await getAccount(this.banksClient, userLpAccount);
    const lpMintEnd = await getMint(this.banksClient, ammStart.lpMint);

    assert.isBelow(Number(lpMintEnd.supply), Number(lpMintStart.supply));
    assert.isBelow(
      Number(userLpAccountEnd.amount),
      Number(userLpAccountStart.amount)
    );

    const ammEnd = await ammClient.getAmm(amm);

    assert.equal(ammEnd.seqNum.toString(), "2");

    assert.isBelow(
      ammEnd.baseAmount.toNumber(),
      ammStart.baseAmount.toNumber()
    );
    assert.isBelow(
      ammEnd.quoteAmount.toNumber(),
      ammStart.quoteAmount.toNumber()
    );
  });
}
