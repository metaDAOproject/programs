import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  DAMM_V2_POOL_AUTHORITY,
  LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";
import {
  CpAmm,
  derivePoolAddress,
  getTokenProgram,
} from "@meteora-ag/cp-amm-sdk";
import {
  FutarchyClient,
  UpdateDaoParams,
} from "@metadaoproject/programs/futarchy/v0.6";
import { buildAdminApprovalTransactions } from "./adminApproval.js";
import { getSquadsPdasFromDao, probeSquadsVaultTransaction } from "./squads.js";
import { sendAndConfirm, sendWithRetries } from "./transactions.js";

const SEED_AMM_POSITION = Buffer.from("amm_position");

// Meteora configs the launchpad versions create a DAO's pool under
const LAUNCHPAD_METEORA_CONFIGS = [
  LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
];

export type DaoActionContext = {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  daoMultisig: PublicKey;
  // The signer of the vault transaction's inner instructions, unless an
  // instruction is signed by the DAO itself (see removeSpendingLimit)
  daoMultisigVault: PublicKey;
  payer: PublicKey;
};

export type DaoAction = {
  // Executed by the DAO's squads vault inside the vault transaction
  instructions: TransactionInstruction[];
  // Payer-funded instructions sent up front, so the vault transaction can't
  // fail at execution time (e.g. creating token accounts)
  setupInstructions?: TransactionInstruction[];
  // Set when the DAO itself signs any of the instructions. Only
  // admin_execute_multisig_proposal signs for the DAO, so the proposal has to
  // be executed with adminExecuteMultisigProposal.ts rather than
  // permissionlessly.
  requiresAdminExecution?: boolean;
};

export type DaoActionBuilder = (ctx: DaoActionContext) => Promise<DaoAction>;

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
  isOptimisticGovernanceEnabled: null,
};

// Updates the given DAO config fields, leaving the omitted ones unchanged
export const updateDao =
  (params: Partial<UpdateDaoParams>): DaoActionBuilder =>
  async ({ futarchy, dao }) => ({
    instructions: [
      await futarchy
        .updateDaoIx({ dao, params: { ...EMPTY_UPDATE_DAO_PARAMS, ...params } })
        .instruction(),
    ],
  });

// Withdraws a fraction of the vault's AMM position into the vault's token
// accounts. The min amounts are set `slippageBps` below what the withdrawn
// liquidity is worth right now, so reserve changes between now and execution
// beyond that tolerance fail the withdrawal instead of silently accepting a
// worse outcome.
export const withdrawLiquidity = ({
  fractionBps,
  slippageBps,
}: {
  fractionBps: number;
  slippageBps: number;
}): DaoActionBuilder => {
  if (
    !Number.isInteger(fractionBps) ||
    fractionBps <= 0 ||
    fractionBps > 10_000
  ) {
    throw new Error(
      `fractionBps must be an integer between 1 and 10000, got ${fractionBps}`,
    );
  }
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw new Error(
      `slippageBps must be an integer between 0 and 10000, got ${slippageBps}`,
    );
  }

  return async ({ futarchy, dao, daoMultisigVault, payer }) => {
    const daoAccount = await futarchy.getDao(dao);

    // The DAO's protocol-owned liquidity position is held by its squads vault
    const [ammPositionPda] = PublicKey.findProgramAddressSync(
      [SEED_AMM_POSITION, dao.toBuffer(), daoMultisigVault.toBuffer()],
      futarchy.futarchy.programId,
    );

    const ammPosition =
      await futarchy.futarchy.account.ammPosition.fetch(ammPositionPda);

    const liquidityToWithdraw = ammPosition.liquidity
      .muln(fractionBps)
      .divn(10_000);
    if (liquidityToWithdraw.isZero()) {
      throw new Error(
        `fractionBps ${fractionBps} rounds down to zero liquidity for this position`,
      );
    }

    const spotPool = daoAccount.amm.state.spot;
    if (!spotPool) {
      throw new Error("DAO AMM is not in spot state");
    }

    // Same math as the program's get_base_and_quote_withdrawable
    const baseWithdrawable = liquidityToWithdraw
      .mul(spotPool.spot.baseReserves)
      .div(daoAccount.amm.totalLiquidity);
    const quoteWithdrawable = liquidityToWithdraw
      .mul(spotPool.spot.quoteReserves)
      .div(daoAccount.amm.totalLiquidity);

    const minBaseAmount = baseWithdrawable
      .muln(10_000 - slippageBps)
      .divn(10_000);
    const minQuoteAmount = quoteWithdrawable
      .muln(10_000 - slippageBps)
      .divn(10_000);

    console.log("AMM position:", ammPositionPda.toBase58());
    console.log("Position liquidity:", ammPosition.liquidity.toString());
    console.log("Liquidity to withdraw:", liquidityToWithdraw.toString());
    console.log("Expected base out:", baseWithdrawable.toString());
    console.log("Expected quote out:", quoteWithdrawable.toString());
    console.log("Min base amount:", minBaseAmount.toString());
    console.log("Min quote amount:", minQuoteAmount.toString());

    const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
      daoAccount.baseMint,
      daoMultisigVault,
      true,
    );
    const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
      daoAccount.quoteMint,
      daoMultisigVault,
      true,
    );

    const withdrawLiquidityIx = await futarchy.futarchy.methods
      .withdrawLiquidity({
        liquidityToWithdraw,
        minBaseAmount,
        minQuoteAmount,
      })
      .accounts({
        dao,
        positionAuthority: daoMultisigVault,
        liquidityProviderBaseAccount: vaultBaseTokenAccount,
        liquidityProviderQuoteAccount: vaultQuoteTokenAccount,
        ammBaseVault: getAssociatedTokenAddressSync(
          daoAccount.baseMint,
          dao,
          true,
        ),
        ammQuoteVault: getAssociatedTokenAddressSync(
          daoAccount.quoteMint,
          dao,
          true,
        ),
        ammPosition: ammPositionPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    return {
      instructions: [withdrawLiquidityIx],
      setupInstructions: [
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultBaseTokenAccount,
          daoMultisigVault,
          daoAccount.baseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultQuoteTokenAccount,
          daoMultisigVault,
          daoAccount.quoteMint,
        ),
      ],
    };
  };
};

// Finds the Meteora DAMM v2 pool the launchpad created for the DAO's mints,
// under whichever of its configs it exists
const findLaunchpadMeteoraPool = async (
  cpAmm: CpAmm,
  futarchy: FutarchyClient,
  dao: PublicKey,
) => {
  const { baseMint, quoteMint } = await futarchy.getDao(dao);
  const candidates = LAUNCHPAD_METEORA_CONFIGS.map((config) =>
    derivePoolAddress(config, baseMint, quoteMint),
  );
  const poolStates =
    await cpAmm._program.account.pool.fetchMultiple(candidates);
  const existing = candidates.filter((_, i) => poolStates[i] !== null);
  if (existing.length === 0) {
    throw new Error(
      "No launchpad-created Meteora pool found for this DAO's mints - pass `pool`",
    );
  }
  if (existing.length > 1) {
    throw new Error(
      `The launchpad created several Meteora pools for this DAO's mints (${existing
        .map((candidate) => candidate.toBase58())
        .join(", ")}) - pass \`pool\``,
    );
  }
  return existing[0];
};

// Withdraws the vault's liquidity from a Meteora DAMM v2 pool - the one the
// launchpad created for the DAO's mints, unless `pool` is given - into the
// vault's token accounts: `fractionBps` of the unlocked liquidity of every
// position the vault holds in the pool. A full withdrawal (the default) removes
// whatever is unlocked when the vault transaction executes; a partial one
// removes that share of what's unlocked now. The min amounts are set
// `slippageBps` below what the withdrawn liquidity is worth right now, so pool
// changes between now and execution beyond that tolerance fail the withdrawal
// instead of silently accepting a worse outcome. Vested and permanently locked
// liquidity stays in the position, as do the fees it has accrued.
export const withdrawMeteoraLiquidity = ({
  pool,
  fractionBps = 10_000,
  slippageBps,
}: {
  pool?: PublicKey;
  fractionBps?: number;
  slippageBps: number;
}): DaoActionBuilder => {
  if (
    !Number.isInteger(fractionBps) ||
    fractionBps <= 0 ||
    fractionBps > 10_000
  ) {
    throw new Error(
      `fractionBps must be an integer between 1 and 10000, got ${fractionBps}`,
    );
  }
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw new Error(
      `slippageBps must be an integer between 0 and 10000, got ${slippageBps}`,
    );
  }

  return async ({ provider, futarchy, dao, daoMultisigVault, payer }) => {
    const cpAmm = new CpAmm(provider.connection);
    const meteoraPool =
      pool ?? (await findLaunchpadMeteoraPool(cpAmm, futarchy, dao));
    const poolState = await cpAmm.fetchPoolState(meteoraPool);

    // The vault signs the withdrawals as the position owner, so only the
    // positions whose NFT it holds count
    const positions = await cpAmm.getUserPositionByPool(
      meteoraPool,
      daoMultisigVault,
    );
    if (positions.length === 0) {
      throw new Error(
        `The DAO's vault holds no position in Meteora pool ${meteoraPool.toBase58()}`,
      );
    }

    const tokenAProgram = getTokenProgram(poolState.tokenAFlag);
    const tokenBProgram = getTokenProgram(poolState.tokenBFlag);
    const vaultTokenAAccount = getAssociatedTokenAddressSync(
      poolState.tokenAMint,
      daoMultisigVault,
      true,
      tokenAProgram,
    );
    const vaultTokenBAccount = getAssociatedTokenAddressSync(
      poolState.tokenBMint,
      daoMultisigVault,
      true,
      tokenBProgram,
    );

    console.log("Meteora pool:", meteoraPool.toBase58());
    console.log("Token A mint:", poolState.tokenAMint.toBase58());
    console.log("Token B mint:", poolState.tokenBMint.toBase58());

    const instructions: TransactionInstruction[] = [];
    for (const { position, positionNftAccount, positionState } of positions) {
      console.log("Meteora position:", position.toBase58());
      console.log(
        "  Unlocked liquidity:",
        positionState.unlockedLiquidity.toString(),
      );
      console.log(
        "  Vested liquidity (stays):",
        positionState.vestedLiquidity.toString(),
      );
      console.log(
        "  Permanently locked liquidity (stays):",
        positionState.permanentLockedLiquidity.toString(),
      );

      if (positionState.unlockedLiquidity.isZero()) {
        console.warn("  No unlocked liquidity - skipping this position");
        continue;
      }

      const liquidityDelta =
        fractionBps === 10_000
          ? positionState.unlockedLiquidity
          : positionState.unlockedLiquidity.muln(fractionBps).divn(10_000);

      // Same math as the program's remove_liquidity
      const { outAmountA, outAmountB } = cpAmm.getWithdrawQuote({
        liquidityDelta,
        sqrtPrice: poolState.sqrtPrice,
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
      });
      const tokenAAmountThreshold = outAmountA
        .muln(10_000 - slippageBps)
        .divn(10_000);
      const tokenBAmountThreshold = outAmountB
        .muln(10_000 - slippageBps)
        .divn(10_000);

      console.log("  Liquidity to withdraw:", liquidityDelta.toString());
      console.log("  Expected token A out:", outAmountA.toString());
      console.log("  Expected token B out:", outAmountB.toString());
      console.log("  Min token A amount:", tokenAAmountThreshold.toString());
      console.log("  Min token B amount:", tokenBAmountThreshold.toString());

      const accounts = {
        poolAuthority: DAMM_V2_POOL_AUTHORITY,
        pool: meteoraPool,
        position,
        positionNftAccount,
        owner: daoMultisigVault,
        tokenAAccount: vaultTokenAAccount,
        tokenBAccount: vaultTokenBAccount,
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAProgram,
        tokenBProgram,
      };

      // A full withdrawal is sized by the program at execution, so liquidity
      // that unlocks before then is withdrawn too
      instructions.push(
        fractionBps === 10_000
          ? await cpAmm._program.methods
              .removeAllLiquidity(tokenAAmountThreshold, tokenBAmountThreshold)
              .accountsPartial(accounts)
              .instruction()
          : await cpAmm._program.methods
              .removeLiquidity({
                liquidityDelta,
                tokenAAmountThreshold,
                tokenBAmountThreshold,
              })
              .accountsPartial(accounts)
              .instruction(),
      );
    }

    if (instructions.length === 0) {
      throw new Error(
        "None of the vault's positions in the pool has unlocked liquidity to withdraw",
      );
    }

    return {
      instructions,
      setupInstructions: [
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultTokenAAccount,
          daoMultisigVault,
          poolState.tokenAMint,
          tokenAProgram,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultTokenBAccount,
          daoMultisigVault,
          poolState.tokenBMint,
          tokenBProgram,
        ),
      ],
    };
  };
};

// Logs the text on-chain when the vault transaction executes, with the vault
// as a verified signer
export const memo =
  (text: string): DaoActionBuilder =>
  async ({ daoMultisigVault }) => ({
    instructions: [createMemoInstruction(text, [daoMultisigVault])],
  });

// Transfers tokens from the vault's associated token account to the recipient
export const transferToken =
  ({
    mint,
    recipient,
    amount,
  }: {
    mint: PublicKey;
    recipient: PublicKey;
    amount: BN;
  }): DaoActionBuilder =>
  async ({ provider, daoMultisigVault, payer }) => {
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      mint,
      daoMultisigVault,
      true,
    );
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      mint,
      recipient,
      true,
    );

    try {
      const vaultBalance =
        await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      console.log("Vault token balance:", vaultBalance.value.uiAmountString);
    } catch {
      console.warn(
        "Vault token account not found - vault holds none of this token yet",
      );
    }

    return {
      instructions: [
        createTransferInstruction(
          vaultTokenAccount,
          recipientTokenAccount,
          daoMultisigVault,
          BigInt(amount.toString()),
        ),
      ],
      setupInstructions: [
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          recipientTokenAccount,
          recipient,
          mint,
        ),
      ],
    };
  };

// Removes the DAO's spending limit, returning its rent to the vault. The DAO
// is its multisig's config authority, so the DAO signs this rather than the
// vault, which makes the proposal admin-execute only.
export const removeSpendingLimit =
  (): DaoActionBuilder =>
  async ({ provider, dao, daoMultisig, daoMultisigVault }) => {
    const [spendingLimit] = multisig.getSpendingLimitPda({
      multisigPda: daoMultisig,
      createKey: dao,
    });
    const spendingLimitAccount =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        provider.connection,
        spendingLimit,
      );

    console.log("Spending limit:", spendingLimit.toBase58());
    console.log(
      `  ${spendingLimitAccount.amount.toString()} of ${spendingLimitAccount.mint.toBase58()} per ${multisig.types.Period[spendingLimitAccount.period]}`,
    );
    console.log(
      "  members:",
      spendingLimitAccount.members.map((m) => m.toBase58()).join(", "),
    );

    return {
      instructions: [
        multisig.instructions.multisigRemoveSpendingLimit({
          multisigPda: daoMultisig,
          configAuthority: dao,
          spendingLimit,
          rentCollector: daoMultisigVault,
        }),
      ],
      requiresAdminExecution: true,
    };
  };

/**
 * Runs the action builders against the DAO's squads accounts. Returns the
 * instructions the DAO's vault should execute, `setupTransaction` - a
 * payer-funded transaction with the actions' setup instructions (null if
 * none), to be signed by the payer and sent before anything else - and
 * `requiresAdminExecution`, set when any action needs the DAO proposal
 * executed through admin_execute_multisig_proposal.
 */
export const buildDaoActions = async ({
  provider,
  futarchy,
  dao,
  payer,
  actions,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: PublicKey;
  actions: DaoActionBuilder[];
}) => {
  const { multisigPda: daoMultisig, vaultPda: daoMultisigVault } =
    await getSquadsPdasFromDao(dao);

  const ctx: DaoActionContext = {
    provider,
    futarchy,
    dao,
    daoMultisig,
    daoMultisigVault,
    payer,
  };

  const built: DaoAction[] = [];
  for (const action of actions) {
    built.push(await action(ctx));
  }

  const setupInstructions = built.flatMap(
    (action) => action.setupInstructions ?? [],
  );
  const instructions = built.flatMap((action) => action.instructions);

  if (instructions.length === 0) {
    throw new Error("No instructions - add at least one action");
  }

  const requiresAdminExecution = built.some(
    (action) => action.requiresAdminExecution,
  );

  let setupTransaction: Transaction | null = null;
  if (setupInstructions.length > 0) {
    setupTransaction = new Transaction().add(...setupInstructions);
    setupTransaction.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    setupTransaction.feePayer = payer;
  }

  return {
    daoMultisig,
    daoMultisigVault,
    instructions,
    setupTransaction,
    requiresAdminExecution,
  };
};

/**
 * Runs the action builders and routes their instructions through the admin
 * approval system. Returns buildDaoActions' `setupTransaction` and
 * `requiresAdminExecution` on top of buildAdminApprovalTransactions' result.
 */
export const buildDaoActionTransactions = async ({
  provider,
  futarchy,
  dao,
  payer,
  actions,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: PublicKey;
  actions: DaoActionBuilder[];
}) => {
  const { instructions, setupTransaction, requiresAdminExecution } =
    await buildDaoActions({ provider, futarchy, dao, payer, actions });

  return {
    setupTransaction,
    requiresAdminExecution,
    ...(await buildAdminApprovalTransactions({
      provider,
      futarchy,
      dao,
      instructions,
      payer,
    })),
  };
};

/**
 * Signs and sends the transactions built by buildDaoActionTransactions in
 * order (setup if any, DAO multisig, ops multisig), logging the created
 * squads transactions and proposals along the way. Each squads transaction
 * is built right before it's sent, so its multisig's transaction index is
 * read as late as possible, and goes through sendWithRetries, which keeps
 * that index pinned across retries and only moves to a fresh one when another
 * proposal took it - which happens on the shared ops multisig.
 */
export const signAndSendDaoActionTransactions = async ({
  provider,
  payer,
  transactions,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  transactions: Awaited<ReturnType<typeof buildDaoActionTransactions>>;
}) => {
  const { setupTransaction, requiresAdminExecution, buildDaoTransaction } =
    transactions;

  let setupSignature: string | null = null;
  if (setupTransaction) {
    setupTransaction.sign(payer);

    setupSignature = await sendAndConfirm(provider, setupTransaction);

    console.log("Setup transaction sent!");
    console.log("Transaction signature:", setupSignature);
  }

  const {
    daoTransactionIndex,
    daoVaultTransactionPda,
    daoProposalPda,
    enqueuedApprovalPda,
    buildMetadaoTransaction,
    signature: daoSignature,
  } = await sendWithRetries({
    provider,
    payer,
    signers: [PERMISSIONLESS_ACCOUNT],
    name: "DAO squads transaction",
    build: async () => {
      const built = await buildDaoTransaction();
      return { ...built, transaction: built.daoTransaction };
    },
    probe: ({ daoVaultTransactionPda, daoInstructions }) =>
      probeSquadsVaultTransaction(
        provider.connection,
        daoVaultTransactionPda,
        daoInstructions,
      ),
  });

  console.log("Squads transaction index:", daoTransactionIndex.toString());
  console.log("Squads transaction:", daoVaultTransactionPda.toBase58());
  console.log("Squads proposal:", daoProposalPda.toBase58());

  const {
    metadaoTransactionIndex,
    metadaoVaultTransactionPda,
    metadaoProposalPda,
    signature: metadaoSignature,
  } = await sendWithRetries({
    provider,
    payer,
    name: "Enqueue approval squads transaction",
    build: async () => {
      const built = await buildMetadaoTransaction();
      return { ...built, transaction: built.metadaoTransaction };
    },
    probe: ({ metadaoVaultTransactionPda, metadaoInstructions }) =>
      probeSquadsVaultTransaction(
        provider.connection,
        metadaoVaultTransactionPda,
        metadaoInstructions,
      ),
  });

  console.log("Squads transaction index:", metadaoTransactionIndex.toString());
  console.log("Squads transaction:", metadaoVaultTransactionPda.toBase58());
  console.log("Squads proposal:", metadaoProposalPda.toBase58());
  console.log("Enqueued approval:", enqueuedApprovalPda.toBase58());
  console.log(
    "Go ahead and approve + execute the enqueue approval through Squads.",
  );
  if (requiresAdminExecution) {
    console.log(
      "The DAO signs some of the enqueued instructions, so the permissionless execute can't run this proposal. Once the enqueue approval executes, run adminExecuteMultisigProposal.ts with the admin key.",
    );
  } else {
    console.log(
      "Then approve + execute the DAO proposal with executeMultisigProposalApproval.ts.",
    );
  }

  return { setupSignature, daoSignature, metadaoSignature };
};
