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
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { DAY_IN_SLOTS, expectError, toBN } from "../../utils.js";
import * as token from "@solana/spl-token";
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

    let proposal = Keypair.generate().publicKey;
    amm = await ammClient.createAmm(proposal, META, USDC, toBN(DAY_IN_SLOTS), 500);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);
  });

  it("adds initial liquidity to an amm", async function () {
    await ammClient
      .addLiquidityIx(
        amm,
        META,
        USDC,
        new BN(5000 * 10 ** 6),
        new BN(6 * 10 ** 9),
        new BN(0)
      )
      .rpc();

    const storedAmm = await ammClient.getAmm(amm);

    assert.equal(storedAmm.seqNum.toString(), "1");

    assert.isTrue(storedAmm.baseAmount.eq(new BN(6 * 10 ** 9)));
    assert.isTrue(storedAmm.quoteAmount.eq(new BN(5000 * 10 ** 6)));

    const lpMint = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        getAmmLpMintAddr(ammClient.program.programId, amm)[0],
        this.payer.publicKey
      )
    );

    assert.equal(lpMint.amount.toString(), (5000 * 10 ** 6).toString());
  });

  it("adds liquidity after it's already been added", async function () {
    await ammClient
      .addLiquidityIx(
        amm,
        META,
        USDC,
        new BN(5000 * 10 ** 6),
        new BN(6 * 10 ** 9),
        new BN(0)
      )
      .rpc();

    const storedAmm = await ammClient.getAmm(amm);

    assert.isTrue(storedAmm.baseAmount.eq(new BN(6 * 10 ** 9)));
    assert.isTrue(storedAmm.quoteAmount.eq(new BN(5000 * 10 ** 6)));

    // const lpMint = await getAccount(
    //     this.banksClient,
    //     getAmmLpMintAddr(ammClient.program.programId, amm)[0]
    // );

    // assert.equal(lpMint.amount.toString(), (7500 * 10 ** 6).toString());
  });
}
