import { PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { RELAUNCH_V0_1_PROGRAM_ID } from "@metadaoproject/programs";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";

export default function suite() {
  it("relaunch program is deployed", async function () {
    const program = await this.banksClient.getAccount(RELAUNCH_V0_1_PROGRAM_ID);

    assert.isNotNull(program);
    assert.isTrue(program!.executable);
  });

  const assertOldMintSetup = async function (
    this: Mocha.Context,
    oldTokenProgram: PublicKey,
  ) {
    const { oldMint, payerOldTokenAccount } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldTokenProgram,
    });

    const rawMint = await this.banksClient.getAccount(oldMint);
    assert.isTrue(rawMint!.owner.equals(oldTokenProgram));

    const mint = token.unpackMint(
      oldMint,
      { ...rawMint!, data: Buffer.from(rawMint!.data) },
      oldTokenProgram,
    );
    assert.equal(mint.decimals, 6);
    assert.equal(mint.supply.toString(), DEFAULT_OLD_SUPPLY.toString());

    const extensions = token.getExtensionTypes(mint.tlvData);
    if (oldTokenProgram.equals(token.TOKEN_2022_PROGRAM_ID)) {
      assert.sameMembers(extensions, [
        token.ExtensionType.MetadataPointer,
        token.ExtensionType.TokenMetadata,
      ]);
    } else {
      assert.isEmpty(extensions);
    }

    const rawTokenAccount =
      await this.banksClient.getAccount(payerOldTokenAccount);
    const tokenAccount = token.unpackAccount(
      payerOldTokenAccount,
      { ...rawTokenAccount!, data: Buffer.from(rawTokenAccount!.data) },
      oldTokenProgram,
    );
    assert.equal(tokenAccount.amount.toString(), DEFAULT_OLD_SUPPLY.toString());
  };

  it("setupRelaunch creates a classic SPL old mint with supply", async function () {
    await assertOldMintSetup.call(this, token.TOKEN_PROGRAM_ID);
  });

  it("setupRelaunch creates a Token-2022 old mint with metadata extensions and supply", async function () {
    await assertOldMintSetup.call(this, token.TOKEN_2022_PROGRAM_ID);
  });
}
