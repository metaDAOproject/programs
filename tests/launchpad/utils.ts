import { PublicKey, Signer, SystemProgram, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/launchpad/v0.6";

export async function initializeMintWithSeeds(
  banksClient: BanksClient,
  launchpadClient: LaunchpadClient,
  payer: Signer,
): Promise<{
  tokenMint: PublicKey;
  launch: PublicKey;
  launchSigner: PublicKey;
}> {
  const seed = Math.random().toString(36).substring(2, 15);
  const tokenMint = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    token.TOKEN_PROGRAM_ID,
  );

  const [launch] = getLaunchAddr(launchpadClient.getProgramId(), tokenMint);
  const [launchSigner] = getLaunchSignerAddr(
    launchpadClient.getProgramId(),
    launch,
  );

  const rent = await banksClient.getRent();
  const lamports = Number(rent.minimumBalance(BigInt(token.MINT_SIZE)));

  const tx = new Transaction().add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: tokenMint,
      basePubkey: payer.publicKey,
      seed,
      lamports: lamports,
      space: token.MINT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(tokenMint, 6, launchSigner, null),
  );
  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  await banksClient.processTransaction(tx);

  return {
    tokenMint,
    launch,
    launchSigner,
  };
}
