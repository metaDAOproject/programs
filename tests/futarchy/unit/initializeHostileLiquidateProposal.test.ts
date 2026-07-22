import {
  FUTARCHY_V0_6_PROGRAM_ID,
  getDaoAddr,
  getEventAuthorityAddr,
  PriceMath,
} from "@metadaoproject/programs";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import { assertVaultTransactionPayload } from "../../utils.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: ONE_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: ONE_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });
  });

  it("bakes an apply_liquidation whose accounts are exactly the derived set, including this proposal's own PDA", async function () {
    const liquidator = Keypair.generate().publicKey;

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    const storedDao = await this.futarchy.getDao(dao);
    const vault = storedDao.squadsMultisigVault;

    const [eventAuthority] = getEventAuthorityAddr(FUTARCHY_V0_6_PROGRAM_ID);
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    const expectedApplyLiquidationIx = await this.futarchy.futarchy.methods
      .applyLiquidation()
      .accounts({
        proposal,
        dao,
        squadsMultisigVault: vault,
        ammPosition,
        ammBaseVault: storedDao.amm.ammBaseVault,
        ammQuoteVault: storedDao.amm.ammQuoteVault,
        vaultBaseAccount: getAssociatedTokenAddressSync(META, vault, true),
        vaultQuoteAccount: getAssociatedTokenAddressSync(USDC, vault, true),
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      })
      .instruction();

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedApplyLiquidationIx,
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isFalse(storedProposal.isTeamSponsored);
    assert.ok(
      storedProposal.action.hostileLiquidate.liquidator.equals(liquidator),
    );

    // 10 days, +25%, unblockable
    assert.equal(storedProposal.durationInSeconds, 864_000);
    assert.equal(storedProposal.passThresholdBps, 2500);
    assert.isFalse(storedProposal.councilCanBlock);

    const updatedDao = await this.futarchy.getDao(dao);
    assert.equal(updatedDao.proposalCount, 1);
  });
}
