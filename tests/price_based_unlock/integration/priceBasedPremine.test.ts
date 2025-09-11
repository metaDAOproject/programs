import { Keypair, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";
import { getDaoAddr, MAINNET_USDC } from "@metadaoproject/futarchy/v0.6";

const DAY_IN_SECONDS = 60 * 60 * 24;

export default function () {
  it("should enable price-based unlocks of a premine", async function () {
    // const premine = await this.priceBasedUnlock.initializePremine();
    const oracleAccount = Keypair.generate();

    const alice = Keypair.generate();

    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    const tokenMint = await this.createMint(this.payer.publicKey, 6);

    // Do the premine
    const fromTokenAccount = await this.createTokenAccount(
      tokenMint,
      this.payer.publicKey
    );
    // await this.mintTo(tokenMint, this.payer.publicKey, this.payer, 100 * 10 ** 6);

    const launch = this.launchpad.getLaunchAddress({ baseMint: tokenMint });
    const launchSigner = this.launchpad.getLaunchSignerAddress({ launch });

    const tx = new Transaction().add(
      token.createSetAuthorityInstruction(
        tokenMint,
        this.payer.publicKey,
        token.AuthorityType.MintTokens,
        launchSigner
      )
    );

    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    await this.banksClient.processTransaction(tx);

    await this.launchpad
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: tokenMint,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        priceBasedUnlockAddress: recipientAddress,
        priceBasedPremineAmount: premineAmount,
        priceBasedUnlockThreshold: new BN("1500000000000"), // 1.5e12 price threshold
      })
      .rpc();

    await this.launchpad.startLaunchIx({ launch }).rpc();

    await this.launchpad.fundIx({ launch, amount: minRaise }).rpc(); // Fund with full minimum raise

    await this.advanceBySeconds(DAY_IN_SECONDS * 7 + 100); // Advance past the 7-day launch period

    await this.launchpad
      .completeLaunchIx({ launch, baseMint: tokenMint })
      .rpc();

    await this.advanceBySeconds(DAY_IN_SECONDS * 365);

    const clock = await this.banksClient.getClock();

    // await this.advanceBySlots(clock.unixTimestamp);

    await this.advanceBySeconds(10);

    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner });

    const locker = this.priceBasedUnlock.getLockerAddress(launchSigner);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: tokenMint,
        swapType: "buy",
        inputAmount: new BN(1 * 10 ** 6),
        minOutputAmount: new BN(0),
        trader: this.payer.publicKey,
      })
      .rpc();

    await this.priceBasedUnlock
      .startUnlockIx({ locker, oracleAccount: dao })
      .rpc();

    await this.advanceBySeconds(300);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: tokenMint,
        swapType: "buy",
        inputAmount: new BN(1 * 10 ** 6),
        minOutputAmount: new BN(0),
        trader: this.payer.publicKey,
      })
      .rpc();

    const aliceTokenAccount = await this.createTokenAccount(
      tokenMint,
      alice.publicKey
    );

    await this.priceBasedUnlock
      .completeUnlockIx({
        locker,

        oracleAccount: dao,
        recipientTokenAccount: aliceTokenAccount,
      })
      .rpc();

    return;

    await this.priceBasedUnlock
      .initializeLockerIx({
        params: {
          priceThreshold: new BN(1000000),
          tokenAmount: new BN(100000),
          unlockTimestamp: new BN(
            Number((await this.context.banksClient.getClock()).unixTimestamp) +
              3600
          ),
          oracleConfig: {
            oracleAccount: this.priceBasedUnlock.programId,
            byteOffset: 0,
          },
          twapLengthSeconds: new BN(300),
          tokenRecipient: this.payer.publicKey,
        },
        createKey: this.payer.publicKey,
        tokenMint,
        fromTokenAccount,
        tokenAuthority: this.payer.publicKey,
        recipientTokenAccount: aliceTokenAccount,
        payer: this.payer.publicKey,
      })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24);

    await this.priceBasedUnlock
      .startUnlockIx({
        locker: this.priceBasedUnlock.getLockerAddress(this.payer.publicKey),
        oracleAccount: this.priceBasedUnlock.programId,
      })
      .rpc();

    const storedLocker = await this.priceBasedUnlock.getLocker(
      this.priceBasedUnlock.getLockerAddress(this.payer.publicKey)
    );
    console.log(storedLocker.state.unlocking);

    await this.priceBasedUnlock
      .completeUnlockIx({
        locker: this.priceBasedUnlock.getLockerAddress(this.payer.publicKey),
        oracleAccount: this.priceBasedUnlock.programId,
        recipientTokenAccount: aliceTokenAccount,
      })
      .rpc();

    const storedLocker2 = await this.priceBasedUnlock.getLocker(
      this.priceBasedUnlock.getLockerAddress(this.payer.publicKey)
    );
    console.log(storedLocker2.state.unlocking);
  });
}
