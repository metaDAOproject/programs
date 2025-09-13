import { ComputeBudgetProgram, Keypair, PublicKey, TransactionMessage } from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import BN from "bn.js";
import { assert } from "chai";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.6";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { ComputeBudget } from "litesvm";

export default function suite() {
    let META: PublicKey, USDC: PublicKey, dao: PublicKey;

    beforeEach(async function () {
        META = await this.createMint(this.payer.publicKey, 6);
        USDC = await this.createMint(this.payer.publicKey, 6);

        await this.mintTo(USDC, this.payer.publicKey, this.payer, 100 * 10 ** 6);
        await this.mintTo(META, this.payer.publicKey, this.payer, 10 * 10 ** 6);

        dao = await this.setupBasicDaoWithLiquidity({ baseMint: META, quoteMint: USDC });
    });

    it("collects fees", async function () {
        // they buy 100 USDC worth, then sell 2 META worth. so we should collect 0.25 USDC and 0.005 META

        await this.futarchy.spotSwapIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
            swapType: "buy",
            inputAmount: new BN(100 * 10 ** 6),
            minOutputAmount: new BN(0),
        }).rpc();

        await this.futarchy.spotSwapIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
            swapType: "sell",
            inputAmount: new BN(2 * 10 ** 6),
            minOutputAmount: new BN(0),
        }).rpc();

        const preQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
        const preBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);

        await this.futarchy.collectFeesIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
        }).rpc();

        const postQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
        const postBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);

        const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
        const baseFeesCollected = postBaseBalance - preBaseBalance;

        assert.equal(quoteFeesCollected, 250_000n);
        assert.equal(baseFeesCollected, 5_000n);
    });

    it("fails when the pool is not in the spot state", async function () {
        const { proposal, question, baseVault, squadsProposal } = await this.initializeAndLaunchProposal({
            dao,
            instructions: [{
                programId: MEMO_PROGRAM_ID,
                keys: [],
                data: Buffer.from("hello, world"),
            }],
        });

        await this.conditionalVault.splitTokensIx(question, baseVault, META, new BN(5 * 10 ** 6), 2).rpc();

        // here we literally swap 1 atom of META, which should result in one atom of META fee because we round up

        this.advanceBySeconds(60 * 60 * 24 * 4);

        await this.futarchy.conditionalSwapIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
            proposal,
            market: "fail",
            swapType: "sell",
            inputAmount: new BN(1),
            minOutputAmount: new BN(0),
        }).rpc();

        const callbacks = expectError("PoolNotInSpotState", "fee collect worked on a futarchy pool");

        await this.futarchy.collectFeesIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
        }).rpc().then(callbacks[0], callbacks[1]);

        await this.futarchy.finalizeProposalIxV2({
            squadsProposal,
            dao,
            baseMint: META,
            quoteMint: USDC,
        }).rpc();

        const preQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
        const preBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);

        await this.futarchy.collectFeesIx({
            dao,
            baseMint: META,
            quoteMint: USDC,
        }).preInstructions([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })]).rpc();

        const postQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);
        const postBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);

        const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
        const baseFeesCollected = postBaseBalance - preBaseBalance;

        assert.equal(quoteFeesCollected, 0n);
        assert.equal(baseFeesCollected, 1n);
    });
}