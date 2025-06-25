import { AutocratClient, getDaoAddr } from "@metadaoproject/futarchy/v0.5";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";

export default function suite() {
it("works", async function () {
    const META = await this.createMint(this.payer.publicKey, 9);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    const nonce = new BN(Math.random() * 2 ** 50);

    const [dao] = getDaoAddr(this.autocratClient.getProgramId(), nonce);

    await this.autocratClient.initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
            nonce,
            twapStartDelaySlots: new BN(0),
            twapInitialObservation: new BN(0),
            twapMaxObservationChangePerUpdate: new BN(0),
            minQuoteFutarchicLiquidity: new BN(0),
            slotsPerProposal: new BN(10),
            passThresholdBps: 300,
            minBaseFutarchicLiquidity: new BN(0),
        }
    }).rpc();

    const storedDao = await this.autocratClient.getDao(dao);

    console.log(storedDao);
    
});

}