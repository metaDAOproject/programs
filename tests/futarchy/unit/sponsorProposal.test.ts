import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";
import { TestContext } from "../../main.test.js";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6,
    );

    dao = await this.setupBasicDao({ baseMint: META, quoteMint: USDC });
  });

  async function createMintTokensDraft(ctx: TestContext) {
    const { squadsMultisigVault } = await ctx.futarchy.getDao(dao);

    const tx = new Transaction().add(
      createSetAuthorityInstruction(
        META,
        ctx.payer.publicKey,
        AuthorityType.MintTokens,
        squadsMultisigVault,
      ),
    );
    [tx.recentBlockhash] = await ctx.banksClient.getLatestBlockhash();
    tx.feePayer = ctx.payer.publicKey;
    tx.sign(ctx.payer);
    await ctx.banksClient.processTransaction(tx);

    return ctx.futarchy.initializeMintTokensProposal({
      dao,
      amount: new BN(1_000_000_000),
      recipient: Keypair.generate().publicKey,
    });
  }

  it("rejects a hostile takeover draft", async function () {
    const { proposal } = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    });

    const callbacks = expectError(
      "TeamSponsorshipForbidden",
      "sponsored a hostile takeover",
    );

    await this.futarchy
      .sponsorProposalIx({ proposal, dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isFalse(storedProposal.isTeamSponsored);
  });

  it("rejects a hostile liquidate draft", async function () {
    const { proposal } = await this.futarchy.initializeHostileLiquidateProposal(
      { dao },
    );

    const callbacks = expectError(
      "TeamSponsorshipForbidden",
      "sponsored a hostile liquidation",
    );

    await this.futarchy
      .sponsorProposalIx({ proposal, dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isFalse(storedProposal.isTeamSponsored);
  });

  it("sponsors a mint tokens draft", async function () {
    const { proposal } = await createMintTokensDraft(this);

    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isTrue(storedProposal.isTeamSponsored);
  });

  it("rejects a second sponsorship", async function () {
    const { proposal } = await createMintTokensDraft(this);

    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    const callbacks = expectError(
      "ProposalAlreadySponsored",
      "sponsored a proposal twice",
    );

    // Compute unit price makes this transaction's hash differ from the first one
    await this.futarchy
      .sponsorProposalIx({ proposal, dao })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a launched proposal", async function () {
    const { proposal, squadsProposal } = await createMintTokensDraft(this);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(10_000 * 10 ** 6),
        maxBaseAmount: new BN(20_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
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

    const callbacks = expectError(
      "ProposalNotInDraftState",
      "sponsored a launched proposal",
    );

    await this.futarchy
      .sponsorProposalIx({ proposal, dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isFalse(storedProposal.isTeamSponsored);
  });

  it("rejects a signer that is not the team", async function () {
    const { proposal } = await createMintTokensDraft(this);
    const stranger = Keypair.generate();

    const callbacks = expectError(
      "ConstraintHasOne",
      "sponsored with a non-team signer",
    );

    await this.futarchy
      .sponsorProposalIx({ proposal, dao, teamAddress: stranger.publicKey })
      .signers([stranger])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isFalse(storedProposal.isTeamSponsored);
  });
}
