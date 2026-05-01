import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { GatedTokenClient } from "@metadaoproject/programs";
import { setupGatedMint } from "../utils.js";
import { expectError } from "../../utils.js";

const TOKEN_ACCOUNT_STATE_OFFSET = 108;
const TOKEN_STATE_INITIALIZED = 1;
const TOKEN_STATE_FROZEN = 2;

async function forceFreezeAccount(
  context: any,
  banksClient: any,
  tokenAccount: PublicKey,
) {
  const acc = await banksClient.getAccount(tokenAccount);
  const data = Buffer.from(acc.data);
  data[TOKEN_ACCOUNT_STATE_OFFSET] = TOKEN_STATE_FROZEN;
  context.setAccount(tokenAccount, {
    data,
    executable: acc.executable,
    owner: acc.owner,
    lamports: acc.lamports,
  });
}

async function getTokenAccountState(
  banksClient: any,
  tokenAccount: PublicKey,
): Promise<number> {
  const acc = await banksClient.getAccount(tokenAccount);
  return acc.data[TOKEN_ACCOUNT_STATE_OFFSET];
}

export default function suite() {
  let gatedTokenClient: GatedTokenClient;
  let admin: Keypair;
  let mint: PublicKey;
  let gatedMintConfig: PublicKey;
  let tokenAccount: PublicKey;

  before(async function () {
    gatedTokenClient = this.gatedToken;
  });

  beforeEach(async function () {
    admin = Keypair.generate();
    ({ mint, gatedMintConfig } = await setupGatedMint(
      this.banksClient,
      gatedTokenClient,
      this.payer,
      admin.publicKey,
    ));

    tokenAccount = await this.createTokenAccount(mint, this.payer.publicKey);
    await forceFreezeAccount(this.context, this.banksClient, tokenAccount);
  });

  it("fails before disable_gating", async function () {
    const callbacks = expectError(
      "GatingNotDisabled",
      "Should have failed because gating is not disabled",
    );

    await gatedTokenClient
      .thawAccountIx({ mint, tokenAccount })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("permissionless caller can thaw after disable_gating", async function () {
    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const stateBefore = await getTokenAccountState(
      this.banksClient,
      tokenAccount,
    );
    assert.equal(stateBefore, TOKEN_STATE_FROZEN);

    await gatedTokenClient.thawAccountIx({ mint, tokenAccount }).rpc();

    const stateAfter = await getTokenAccountState(
      this.banksClient,
      tokenAccount,
    );
    assert.equal(stateAfter, TOKEN_STATE_INITIALIZED);

    const cfg = await gatedTokenClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.seqNum.toString(), "2");
  });

  it("returns SPL token error when thawing already-thawed account", async function () {
    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    await gatedTokenClient.thawAccountIx({ mint, tokenAccount }).rpc();

    try {
      await gatedTokenClient
        .thawAccountIx({ mint, tokenAccount })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .rpc();

      assert.fail("Should have failed because account is already thawed");
    } catch (e) {
      assert.include(e.message, "custom program error");
    }
  });

  it("fails when token_account.mint does not match", async function () {
    const otherMint = await this.createMint(this.payer.publicKey, 6);
    const otherTokenAccount = await this.createTokenAccount(
      otherMint,
      this.payer.publicKey,
    );

    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "MintMismatch",
      "Should have failed because token account mint does not match gated mint",
    );

    await gatedTokenClient
      .thawAccountIx({ mint, tokenAccount: otherTokenAccount })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
