import { Keypair } from "@solana/web3.js";
import BN from "bn.js";

export default function () {
    it("should enable price-based unlocks of a premine", async function () {
        // const premine = await this.priceBasedUnlock.initializePremine();
        const oracleAccount = Keypair.generate();

        const alice = Keypair.generate();

        const tokenMint = await this.createMint(this.payer.publicKey, 6);
        const fromTokenAccount = await this.createTokenAccount(tokenMint, this.payer.publicKey);
        await this.mintTo(tokenMint, this.payer.publicKey, this.payer, 100 * 10 ** 6);

        const aliceTokenAccount = await this.createTokenAccount(tokenMint, alice.publicKey);
        const lockerTokenAccount = await this.createTokenAccount(tokenMint, this.priceBasedUnlock.getLockerAddress(this.payer.publicKey));

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
            lockerTokenAccount,
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