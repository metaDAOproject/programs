import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  PERMISSIONLESS_ACCOUNT,
  UpdateDaoParams,
} from "@metadaoproject/programs";
import { TestContext } from "../main.test.js";
import {
  executeVaultTransaction,
  forceApproveSquadsProposal,
} from "../utils.js";

// Re-encodes an account in place, padded back to its allocated length, for
// states no instruction on the branch can produce.
export async function rewriteAccount(
  ctx: TestContext,
  address: PublicKey,
  name: "proposal" | "dao",
  mutate: (decoded: any) => void,
) {
  const raw = await ctx.banksClient.getAccount(address);
  const coder = ctx.futarchy.futarchy.account[name].coder.accounts;
  const decoded = coder.decode(name, Buffer.from(raw.data));

  mutate(decoded);

  const buf = Buffer.alloc(raw.data.length);
  (await coder.encode(name, decoded)).copy(buf, 0);

  ctx.context.setAccount(address, { ...raw, data: buf });
}

// Puts the DAO's typed-proposals switch in the given state. No instruction
// turns it off, so tests that need an off DAO rewrite the account.
export async function setTypedProposalsEnabled(
  ctx: TestContext,
  dao: PublicKey,
  enabled: boolean,
) {
  await rewriteAccount(ctx, dao, "dao", (decoded) => {
    decoded.typedProposalsEnabled = enabled;
  });
}

const EMPTY_UPDATE_DAO_PARAMS: UpdateDaoParams = {
  passThresholdBps: null,
  secondsPerProposal: null,
  twapInitialObservation: null,
  twapMaxObservationChangePerUpdate: null,
  twapStartDelaySeconds: null,
  minQuoteFutarchicLiquidity: null,
  minBaseFutarchicLiquidity: null,
  baseToStake: null,
  teamSponsoredPassThresholdBps: null,
  teamAddress: null,
  typedProposalsEnabled: null,
};

// Runs a vault-signed update_dao without a market: a Squads vault transaction
// and proposal at the multisig's next index, force-approved and executed.
// Omitted params are left unchanged.
export async function updateDaoViaVault(
  ctx: TestContext,
  dao: PublicKey,
  params: Partial<UpdateDaoParams>,
) {
  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    ctx.squadsConnection,
    multisigPda,
  );
  const transactionIndex =
    BigInt(multisigAccount.transactionIndex.toString()) + 1n;

  const updateDaoIx = await ctx.futarchy
    .updateDaoIx({ dao, params: { ...EMPTY_UPDATE_DAO_PARAMS, ...params } })
    .instruction();

  const { tx, squadsProposal } = ctx.futarchy.squadsProposalCreateTx({
    dao,
    instructions: [updateDaoIx],
    transactionIndex,
  });
  [tx.recentBlockhash] = await ctx.banksClient.getLatestBlockhash();
  tx.feePayer = ctx.payer.publicKey;
  tx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);
  await ctx.banksClient.processTransaction(tx);

  await forceApproveSquadsProposal(ctx, squadsProposal);

  const [squadsTransaction] = multisig.getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });
  await executeVaultTransaction(ctx, dao, squadsTransaction);
}

// An error inside a vault-executed instruction surfaces through Squads'
// execute as a bare transaction error carrying only the custom error code,
// so the name is resolved through the IDL and matched as hex.
export async function expectVaultExecutionError(
  ctx: TestContext,
  execution: Promise<unknown>,
  errorName: string,
) {
  const error = ctx.futarchy.futarchy.idl.errors.find(
    (e) => e.name === errorName,
  );
  assert.exists(error, `unknown futarchy error ${errorName}`);
  const expected = `custom program error: 0x${error.code.toString(16)}`;

  await execution.then(
    () => assert.fail(`should have failed with ${errorName}`),
    (e) =>
      assert.include(
        e.toString(),
        expected,
        `Expected ${errorName}, got: ${e}`,
      ),
  );
}
