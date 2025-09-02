import { Keypair, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";
import { MAINNET_USDC } from "@metadaoproject/futarchy/v0.6";

export default function () {
    it("should enable price-based unlocks of a premine", async function () {
        // const premine = await this.priceBasedUnlock.initializePremine();
        const oracleAccount = Keypair.generate();

        const alice = Keypair.generate();

        const tokenMint = await this.createMint(this.payer.publicKey, 6);
        const usdcMint = await this.createMint(this.payer.publicKey, 6);

        // Do the premine
        const fromTokenAccount = await this.createTokenAccount(tokenMint, this.payer.publicKey);
        // await this.mintTo(tokenMint, this.payer.publicKey, this.payer, 100 * 10 ** 6);

        const launch = this.launchpad.getLaunchAddress({baseMint: tokenMint});
        const launchSigner = this.launchpad.getLaunchSignerAddress({launch});

        const tx = new Transaction().add(
            token.createSetAuthorityInstruction(tokenMint, this.payer.publicKey, token.AuthorityType.MintTokens, launchSigner)
        );

        tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
        tx.feePayer = this.payer.publicKey;
        tx.sign(this.payer);

        await this.banksClient.processTransaction(tx);

        await this.launchpad.initializeLaunchIx({
            tokenName: "Test Project",
            tokenSymbol: "TPJ",
            tokenUri: "https://example.com",
            secondsForLaunch: 60 * 60 * 24,
            minimumRaiseAmount: new BN(1 * 10 ** 6),
            baseMint: tokenMint,
            monthlySpendingLimitAmount: new BN(1),
            monthlySpendingLimitMembers: [this.payer.publicKey],
            priceBasedUnlockAddress: this.payer.publicKey,
            priceBasedPremineAmount: new BN(1 * 10 ** 6),
        }).rpc();

        await this.launchpad.startLaunchIx({ launch }).rpc();

        await this.launchpad.fundIx({ launch, amount: new BN(1 * 10 ** 6) }).rpc();

        await this.advanceBySeconds(60 * 60 * 24 + 100);

        await this.launchpad.completeLaunchIx({ launch, baseMint: tokenMint, priceBasedUnlockRecipient: alice.publicKey }).rpc();




        return;

        await this.priceBasedUnlock.initializeLockerIx({
            params: {
                priceThreshold: new BN(1000000),
                tokenAmount: new BN(100000),
                unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600),
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
            payer: this.payer.publicKey
        }).rpc();

        await this.advanceBySeconds(60 * 60 * 24);

        await this.priceBasedUnlock.startUnlockIx({
            locker: this.priceBasedUnlock.getLockerAddress(this.payer.publicKey),
            oracleAccount: this.priceBasedUnlock.programId,
        }).rpc();

        const storedLocker = await this.priceBasedUnlock.getLocker(this.priceBasedUnlock.getLockerAddress(this.payer.publicKey));
        console.log(storedLocker.state.unlocking);

        await this.priceBasedUnlock.completeUnlockIx({
            locker: this.priceBasedUnlock.getLockerAddress(this.payer.publicKey),
            oracleAccount: this.priceBasedUnlock.programId,
            recipientTokenAccount: aliceTokenAccount,
        }).rpc();

        const storedLocker2 = await this.priceBasedUnlock.getLocker(this.priceBasedUnlock.getLockerAddress(this.payer.publicKey));
        console.log(storedLocker2.state.unlocking);
    });
}