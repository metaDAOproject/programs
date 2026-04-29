import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import { AutocratClient } from "@metadaoproject/programs/autocrat/v0.5";

async function main() {
  const provider = anchor.AnchorProvider.env();
  const autocratProgram = AutocratClient.createClient({ provider });
  const payer = provider.wallet["payer"];

  let assignIx = SystemProgram.assign({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    programId: autocratProgram.getProgramId(),
  });

  let allocateIx = SystemProgram.allocate({
    accountPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    space: 8,
  });

  let transferIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: PERMISSIONLESS_ACCOUNT.publicKey,
    lamports: 10_000_000,
  });
  console.log("assigning permissionless account to autocrat program");
  let assignTx = new Transaction().add(allocateIx, assignIx, transferIx);
  assignTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  )[0];
  assignTx.feePayer = payer.publicKey;
  //   assignTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

  await provider.connection.sendTransaction(assignTx, [
    payer,
    PERMISSIONLESS_ACCOUNT,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
