import BN from "bn.js";
import * as token from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

import { secondsPerDay } from "../../utils/constants.js";
import {
  assertMinSolBalance,
  assertTokenMatchesConstants,
} from "../../utils/launch/checks.js";
import {
  deriveLaunch,
  deriveLaunchSigner,
  deriveTokenMint,
} from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import { simulateAndSendVersioned } from "../../utils/transactions.js";
import type { LaunchConfig } from "./types.js";

export async function initializeLaunch(config: LaunchConfig): Promise<void> {
  const { provider, payer, launchpad } = createLaunchContext();

  await assertMinSolBalance(provider.connection, payer.publicKey);

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  const TOKEN = await deriveTokenMint(payer.publicKey, config.TOKEN_SEED);
  console.log("Token address:", TOKEN.toBase58());
  await assertTokenMatchesConstants(TOKEN, config.TOKEN_ADDRESS);

  const launch = deriveLaunch(TOKEN);
  const launchSigner = deriveLaunchSigner(launch);
  console.log("Launch address:", launch.toBase58());
  console.log("Paste LAUNCH_ADDRESS into constants.ts if unset.");

  if (!payer.publicKey.equals(config.LAUNCH_AUTHORITY)) {
    console.warn(
      `Warning: payer ${payer.publicKey.toBase58()} !== LAUNCH_AUTHORITY ${config.LAUNCH_AUTHORITY.toBase58()}`,
    );
  }

  const createTokenAccountIx = SystemProgram.createAccountWithSeed({
    fromPubkey: payer.publicKey,
    newAccountPubkey: TOKEN,
    basePubkey: payer.publicKey,
    seed: config.TOKEN_SEED,
    lamports,
    space: token.MINT_SIZE,
    programId: token.TOKEN_PROGRAM_ID,
  });

  const initializeMintIx = token.createInitializeMint2Instruction(
    TOKEN,
    6,
    launchSigner,
    null,
  );

  const launchDurationSeconds = secondsPerDay * config.LAUNCH_DAYS;

  const launchIx = await launchpad
    .initializeLaunchIx({
      tokenName: config.TOKEN_NAME,
      tokenSymbol: config.TOKEN_SYMBOL,
      tokenUri: config.TOKEN_URI,
      minimumRaiseAmount: new BN(config.MIN_GOAL * 10 ** 6),
      baseMint: TOKEN,
      monthlySpendingLimitAmount: new BN(config.SPENDING_LIMIT * 10 ** 6),
      monthlySpendingLimitMembers: config.SPENDING_MEMBERS,
      performancePackageGrantee: config.PERFORMANCE_PACKAGE_GRANTEE,
      performancePackageTokenAmount: new BN(
        config.PERFORMANCE_PACKAGE_TOKEN_AMOUNT * 10 ** 6,
      ),
      monthsUntilInsidersCanUnlock: config.PERFORMANCE_PACKAGE_UNLOCK_MONTHS,
      secondsForLaunch: launchDurationSeconds,
      teamAddress: config.TEAM_ADDRESS,
      additionalTokensAmount: config.ADDITIONAL_CARVEOUT
        ? new BN(config.ADDITIONAL_CARVEOUT * 10 ** 6)
        : undefined,
      additionalTokensRecipient: config.ADDITIONAL_CARVEOUT_RECIPIENT,
      launchAuthority: config.LAUNCH_AUTHORITY,
      hasBidWall: false,
    })
    .instruction();

  const txHash = await simulateAndSendVersioned(
    [createTokenAccountIx, initializeMintIx, launchIx],
    payer,
    provider.connection,
  );

  console.log("Launch initialized", txHash);
  console.log(`Set LAUNCH_ADDRESS = new PublicKey("${launch.toBase58()}")`);
}
