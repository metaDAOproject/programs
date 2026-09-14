import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import bs58 from "bs58";
import {
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  DAMM_V2_POOL_AUTHORITY,
  LAUNCHPAD_V0_6_PROGRAM_ID,
  LAUNCHPAD_V0_7_PROGRAM_ID,
  LAUNCHPAD_V0_8_PROGRAM_ID,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";
import {
  CpAmm,
  derivePositionAddress,
  derivePositionNftAccount,
  getTokenProgram,
} from "@meteora-ag/cp-amm-sdk";
import {
  FutarchyClient,
  UpdateDaoParams,
} from "@metadaoproject/programs/futarchy/v0.6";
import {
  LimitsParams,
  PriceBasedPerformancePackageClient,
} from "@metadaoproject/programs/price_based_performance_package";
import { buildAdminApprovalTransactions } from "./adminApproval.js";
import { getSquadsPdasFromDao, probeSquadsVaultTransaction } from "./squads.js";

const SEED_AMM_POSITION = Buffer.from("amm_position");
const SEED_POSITION_NFT_MINT = Buffer.from("position_nft_mint");

// Launchpad versions that create a DAO's Meteora position at launch, all
// seeding its NFT mint from the base mint
const LAUNCHPAD_PROGRAM_IDS = [
  LAUNCHPAD_V0_6_PROGRAM_ID,
  LAUNCHPAD_V0_7_PROGRAM_ID,
  LAUNCHPAD_V0_8_PROGRAM_ID,
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

// Withdraws all unlocked liquidity from the Meteora DAMM v2 position the
// launchpad created for the DAO into the vault's token accounts. The min
// amounts are set `slippageBps` below what the position is worth right now,
// so pool changes between now and execution beyond that tolerance fail the
// withdrawal instead of silently accepting a worse outcome.
export const withdrawMeteoraLiquidity = ({
  slippageBps,
}: {
  slippageBps: number;
}): DaoActionBuilder => {
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
    const daoAccount = await futarchy.getDao(dao);
    const cpAmm = new CpAmm(provider.connection);

    // Any launchpad version may have launched the DAO, so use whichever
    // version's position exists
    const candidates = LAUNCHPAD_PROGRAM_IDS.map((launchpadProgramId) => {
      const [positionNftMint] = PublicKey.findProgramAddressSync(
        [SEED_POSITION_NFT_MINT, daoAccount.baseMint.toBuffer()],
        launchpadProgramId,
      );
      return {
        positionNftMint,
        position: derivePositionAddress(positionNftMint),
      };
    });
    const positionStates = await cpAmm._program.account.position.fetchMultiple(
      candidates.map((candidate) => candidate.position),
    );
    const foundIndex = positionStates.findIndex((state) => state !== null);
    if (foundIndex === -1) {
      throw new Error(
        "No launchpad-created Meteora position found for this DAO",
      );
    }
    const { positionNftMint, position } = candidates[foundIndex];
    const positionState = positionStates[foundIndex]!;
    const positionNftAccount = derivePositionNftAccount(positionNftMint);

    // The vault signs the withdrawal as the position owner, so it must hold
    // the position NFT
    const positionNft = await getAccount(
      provider.connection,
      positionNftAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    if (!positionNft.owner.equals(daoMultisigVault)) {
      throw new Error(
        `Position NFT is owned by ${positionNft.owner.toBase58()}, not the DAO's vault`,
      );
    }

    const liquidity = positionState.unlockedLiquidity;
    if (liquidity.isZero()) {
      throw new Error("The position has no unlocked liquidity to withdraw");
    }

    const poolState = await cpAmm.fetchPoolState(positionState.pool);

    // Same math as the program's remove_all_liquidity
    const { outAmountA, outAmountB } = cpAmm.getWithdrawQuote({
      liquidityDelta: liquidity,
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

    console.log("Meteora pool:", positionState.pool.toBase58());
    console.log("Meteora position:", position.toBase58());
    console.log("Unlocked liquidity:", liquidity.toString());
    console.log(
      "Vested liquidity (stays):",
      positionState.vestedLiquidity.toString(),
    );
    console.log(
      "Permanently locked liquidity (stays):",
      positionState.permanentLockedLiquidity.toString(),
    );
    console.log("Token A mint:", poolState.tokenAMint.toBase58());
    console.log("Token B mint:", poolState.tokenBMint.toBase58());
    console.log("Expected token A out:", outAmountA.toString());
    console.log("Expected token B out:", outAmountB.toString());
    console.log("Min token A amount:", tokenAAmountThreshold.toString());
    console.log("Min token B amount:", tokenBAmountThreshold.toString());

    const removeAllLiquidityIx = await cpAmm._program.methods
      .removeAllLiquidity(tokenAAmountThreshold, tokenBAmountThreshold)
      .accountsPartial({
        poolAuthority: DAMM_V2_POOL_AUTHORITY,
        pool: positionState.pool,
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
      })
      .instruction();

    return {
      instructions: [removeAllLiquidityIx],
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

// Proposes new unlock terms for a performance package whose authority is the
// DAO's vault: a new cliff, and per-window withdrawal limits or none. The vault
// is the proposer and pays the change request's rent, so it needs a little
// SOL. The package's recipient executes the change with executeChange.ts.
export const proposePerformancePackageUnlockTerms =
  ({
    performancePackage,
    minUnlockTimestamp,
    limits,
    pdaNonce,
  }: {
    performancePackage: PublicKey;
    minUnlockTimestamp: BN;
    limits: LimitsParams | null;
    pdaNonce: number;
  }): DaoActionBuilder =>
  async ({ provider, daoMultisigVault }) => {
    const priceBasedPerformancePackage =
      PriceBasedPerformancePackageClient.createClient({ provider });

    const performancePackageAccount =
      await priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    if (
      !performancePackageAccount.performancePackageAuthority.equals(
        daoMultisigVault,
      )
    ) {
      throw new Error(
        `Performance package ${performancePackage.toBase58()} has authority ${performancePackageAccount.performancePackageAuthority.toBase58()}, not the DAO's vault`,
      );
    }

    // The proposal fails at execution if the change request already exists
    const changeRequest = priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      daoMultisigVault,
      pdaNonce,
    );
    if ((await provider.connection.getAccountInfo(changeRequest)) !== null) {
      throw new Error(
        `Change request ${changeRequest.toBase58()} already exists - use another pdaNonce`,
      );
    }

    console.log("Performance package:", performancePackage.toBase58());
    console.log("Recipient:", performancePackageAccount.recipient.toBase58());
    console.log(
      "Current min unlock timestamp:",
      performancePackageAccount.minUnlockTimestamp.toString(),
    );
    console.log("Change request:", changeRequest.toBase58());

    return {
      instructions: [
        await priceBasedPerformancePackage
          .proposeChangeIx({
            params: {
              changeType: { unlockTerms: { minUnlockTimestamp, limits } },
              pdaNonce,
            },
            performancePackage,
            proposer: daoMultisigVault,
          })
          // The vault pays the rent; otherwise the payer defaults to the wallet
          .accounts({ payer: daoMultisigVault })
          .instruction(),
      ],
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

// Sends a signed transaction, throwing if it isn't confirmed or lands with an
// error
export const sendAndConfirm = async (
  provider: AnchorProvider,
  transaction: Transaction,
) => {
  const signature = await provider.connection.sendRawTransaction(
    transaction.serialize(),
  );
  const status = await provider.connection.confirmTransaction(
    signature,
    "confirmed",
  );
  if (status.value.err) {
    throw new Error(
      `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
    );
  }
  return signature;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A preflight rejection: the node simulated the transaction and refused to
// forward it. Any other send error may have come back after the transaction
// was forwarded.
const isPreflightRejection = (error: unknown) =>
  error instanceof SendTransactionError &&
  error.message.includes("Transaction simulation failed");

/**
 * What a probe found at the accounts a transaction creates: they exist
 * holding what the transaction puts there (`landed`), don't exist (`absent`),
 * or exist holding something else, like another proposal at the same squads
 * transaction index (`taken`).
 */
export type ProbeResult = "landed" | "absent" | "taken";

/**
 * Sends a transaction, retrying until it's confirmed at the confirmed
 * commitment or `attempts` run out, without a retry ever duplicating what an
 * earlier attempt created:
 *
 * - A preflight rejection was never broadcast. Any other send error is
 *   followed by confirming the signature until it lands or its blockhash
 *   expires, after which it can't land anymore.
 * - Before each attempt, `probe` looks at the created accounts: an attempt
 *   that landed without being confirmed is adopted, and when another
 *   transaction took the address the transaction is rebuilt via `build`.
 *   Otherwise `build` is called once, so an address it derives from mutable
 *   state (a squads transaction index) stays pinned across attempts.
 *
 * Returns what `build` returned plus the confirmed signature - null when the
 * probe found the accounts before anything was sent.
 */
export const sendWithRetries = async <T extends { transaction: Transaction }>({
  provider,
  payer,
  signers = [],
  name,
  build,
  probe,
  attempts = 5,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  signers?: Keypair[];
  name: string;
  build: () => Promise<T>;
  probe: (built: T) => Promise<ProbeResult>;
  attempts?: number;
}): Promise<T & { signature: string | null }> => {
  let built = await build();
  let lastSignature: string | null = null;
  let lastError: unknown;

  const landed = () => {
    if (lastSignature) {
      console.log(`${name} landed!`);
      console.log("Transaction signature:", lastSignature);
    } else {
      console.log(`${name} already exists - skipping`);
    }
    return { ...built, signature: lastSignature };
  };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const state = await probe(built);
    if (state === "landed") {
      return landed();
    }
    if (state === "taken") {
      console.warn(`${name}: address taken by another transaction, rebuilding`);
      built = await build();
    }

    try {
      const { transaction } = built;
      const { blockhash, lastValidBlockHeight } =
        await provider.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer, ...signers);
      const signature = bs58.encode(transaction.signature!);

      try {
        await provider.connection.sendRawTransaction(transaction.serialize(), {
          preflightCommitment: "confirmed",
        });
      } catch (error) {
        if (isPreflightRejection(error)) {
          throw error;
        }
        // May have been forwarded before the error came back - confirm it
        // like a sent one
      }
      lastSignature = signature;

      const status = await provider.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (status.value.err) {
        throw new Error(
          `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
        );
      }

      console.log(`${name} created!`);
      console.log("Transaction signature:", signature);
      return { ...built, signature };
    } catch (error) {
      lastError = error;
      console.warn(
        `${name}: attempt ${attempt} of ${attempts} failed -`,
        error instanceof Error ? error.message : error,
      );
      if (attempt < attempts) {
        await sleep(2_000);
      }
    }
  }

  // Out of attempts - a last look so the failure is reported truthfully
  const state = await probe(built);
  if (state === "landed") {
    return landed();
  }
  console.error(
    state === "taken"
      ? `${name}: giving up - another transaction took the address, nothing of this run's landed`
      : `${name}: giving up - nothing landed`,
  );
  throw lastError;
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
