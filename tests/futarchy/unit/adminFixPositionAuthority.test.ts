import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  FUTARCHY_PROGRAM_ID,
  LAUNCHPAD_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.7";
import { LAUNCHPAD_PROGRAM_ID as V06_LAUNCHPAD_PROGRAM_ID } from "@metadaoproject/futarchy/v0.6";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expectError } from "../../utils.js";
import * as multisig from "@sqds/multisig";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000 * 10 ** 6);
    await this.mintTo(META, this.payer.publicKey, this.payer, 1000 * 10 ** 6);

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("fixes corrupted position_authority to squads vault", async function () {
    const storedDao = await this.futarchy.getDao(dao);
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    // Provide liquidity with positionAuthority = squadsMultisigVault
    // This creates the AmmPosition PDA derived from squadsMultisigVault
    await this.mintTo(META, this.payer.publicKey, this.payer, 1000 * 10 ** 6);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000 * 10 ** 6);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100 * 10 ** 6),
        maxBaseAmount: new BN(200 * 10 ** 6),
        minLiquidity: new BN(1),
        positionAuthority: squadsMultisigVault,
        liquidityProvider: this.payer.publicKey,
      })
      .rpc();

    // Derive the amm_position PDA
    const [ammPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        squadsMultisigVault.toBuffer(),
      ],
      FUTARCHY_PROGRAM_ID,
    );

    // Verify the position was created correctly (current code is fixed)
    const positionBefore =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);
    assert.isTrue(positionBefore.positionAuthority.equals(squadsMultisigVault));

    // Now simulate the bug: overwrite position_authority with the v0.7 launch signer
    const [v07Launch] = PublicKey.findProgramAddressSync(
      [Buffer.from("launch"), META.toBuffer()],
      LAUNCHPAD_PROGRAM_ID,
    );
    const [v07LaunchSigner] = PublicKey.findProgramAddressSync(
      [Buffer.from("launch_signer"), v07Launch.toBuffer()],
      LAUNCHPAD_PROGRAM_ID,
    );

    // Read raw account data and corrupt the position_authority field
    const rawAccount = await this.banksClient.getAccount(ammPositionPda);
    const data = Buffer.from(rawAccount.data);

    // AmmPosition layout: 8 (discriminator) + 32 (dao) + 32 (position_authority) + 16 (liquidity)
    // position_authority starts at offset 40
    data.set(v07LaunchSigner.toBuffer(), 40);

    this.context.setAccount(ammPositionPda, {
      ...rawAccount,
      data,
    });

    // Verify the corruption
    const positionCorrupted =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);
    assert.isTrue(positionCorrupted.positionAuthority.equals(v07LaunchSigner));

    const daoBefore = await this.futarchy.getDao(dao);
    const seqNumBefore = daoBefore.seqNum.toNumber();

    // Call admin_fix_position_authority to fix it
    await this.futarchy.adminFixPositionAuthorityIx({ dao }).rpc();

    // Verify the fix
    const positionAfter =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);
    assert.isTrue(positionAfter.positionAuthority.equals(squadsMultisigVault));

    // Verify seq_num incremented
    const storedDaoAfter = await this.futarchy.getDao(dao);
    assert.equal(storedDaoAfter.seqNum.toNumber(), seqNumBefore + 1);

    // Verify liquidity is untouched
    assert.isTrue(positionAfter.liquidity.eq(positionBefore.liquidity));
  });

  it("rejects when position_authority is not a recognized launch signer", async function () {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    // Provide liquidity with positionAuthority = squadsMultisigVault
    await this.mintTo(META, this.payer.publicKey, this.payer, 1000 * 10 ** 6);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000 * 10 ** 6);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100 * 10 ** 6),
        maxBaseAmount: new BN(200 * 10 ** 6),
        minLiquidity: new BN(1),
        positionAuthority: squadsMultisigVault,
        liquidityProvider: this.payer.publicKey,
      })
      .rpc();

    // The position_authority is correctly set to squadsMultisigVault (not a launch signer),
    // so the fix instruction should reject it
    const callbacks = expectError(
      "AssertFailed",
      "should reject when position_authority is not a launch signer",
    );

    await this.futarchy
      .adminFixPositionAuthorityIx({ dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
