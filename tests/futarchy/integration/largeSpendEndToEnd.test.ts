import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { executeVaultTransaction } from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// The "behaviorally optimistic" replacement claim: a sponsored, uncontested
// team payment goes through at -10% with no optimistic machinery.
export default function suite() {
  it("pays the team's quote ATA: sponsor, launch, uncontested pass at -10%, execute", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      1_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    const team = Keypair.generate();
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: team.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // 3x the monthly limit: the largest spend the kind allows
    const amount = new BN(3_000_000_000); // 3,000 USDC

    // The payload's destination, pinned to dao.team_address at create
    await this.createTokenAccount(USDC, team.publicKey);

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeLargeSpendProposal({ dao, amount });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: team.publicKey,
      })
      .signers([team])
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    // Nobody contests the market: one swap after the TWAP start delay records
    // an observation in both markets and leaves the TWAPs equal
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();

    // Past the kind's 1.5-day duration snapshot; equal TWAPs clear the -10%
    // snapshot threshold
    await this.advanceBySeconds(129_600);
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    // Fund the treasury ATA the payload pulls from, then execute
    const storedDao = await this.futarchy.getDao(dao);
    const vault = storedDao.squadsMultisigVault;
    await this.createTokenAccount(USDC, vault);
    await this.mintTo(USDC, vault, this.payer, amount.toNumber());

    await executeVaultTransaction(this, dao, squadsTransaction);

    assert.equal(
      (await this.getTokenBalance(USDC, team.publicKey)).toString(),
      amount.toString(),
    );
    assert.equal((await this.getTokenBalance(USDC, vault)).toString(), "0");
  });
}
