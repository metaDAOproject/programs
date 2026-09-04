import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import {
  Keypair,
  PublicKey,
  RpcResponseAndContext,
  SendTransactionError,
  SignatureResult,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  FutarchyClient,
  UpdateDaoParams,
} from "@metadaoproject/programs/futarchy/v0.6";
import { buildAdminApprovalTransactions } from "./adminApproval.js";
import { getSquadsPdasFromDao } from "./squads.js";

const SEED_AMM_POSITION = Buffer.from("amm_position");

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
 * Runs the action builders and routes their instructions through the admin
 * approval system. On top of buildAdminApprovalTransactions' result, returns
 * `setupTransaction` - a payer-funded transaction with the actions' setup
 * instructions (null if none), to be signed by the payer and sent before the
 * others - and `requiresAdminExecution`, set when any action needs the DAO
 * proposal executed through admin_execute_multisig_proposal.
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
    throw new Error("No instructions to enqueue - add at least one action");
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
const sendAndConfirm = async (
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

/**
 * Signs and sends the transactions built by buildDaoActionTransactions in
 * order (setup if any, DAO multisig, ops multisig), logging the created
 * squads transactions and proposals along the way. Each squads transaction
 * is built right before it's sent, so its multisig's transaction index is
 * read as late as possible, and enqueue proposal creation retries with a
 * freshly built transaction when an attempt definitively fails (e.g. an
 * index collision with another operator's proposal on the shared ops
 * multisig).
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

  // Built only now so the DAO multisig's transaction index is fresh
  const {
    daoTransaction,
    daoTransactionIndex,
    daoVaultTransactionPda,
    daoProposalPda,
    enqueuedApprovalPda,
    buildMetadaoTransaction,
  } = await buildDaoTransaction();

  daoTransaction.sign(payer, PERMISSIONLESS_ACCOUNT);

  const daoSignature = await sendAndConfirm(provider, daoTransaction);

  console.log("DAO squads transaction created!");
  console.log("Transaction signature:", daoSignature);
  console.log("Squads transaction index:", daoTransactionIndex.toString());
  console.log("Squads transaction:", daoVaultTransactionPda.toBase58());
  console.log("Squads proposal:", daoProposalPda.toBase58());

  // The ops multisig is shared, so another operator's proposal can consume
  // the transaction index between the build's index read and our transaction
  // landing. A definitively failed attempt rebuilds with a fresh index and
  // retries; an ambiguous confirmation timeout is not retried, since the
  // transaction may still land and a second attempt would then create a
  // duplicate enqueue proposal.
  const sendEnqueueTransactionWithRetries = async (attempts: number) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const enqueue = await buildMetadaoTransaction();
      enqueue.metadaoTransaction.sign(payer);

      let signature: string;
      try {
        signature = await provider.connection.sendRawTransaction(
          enqueue.metadaoTransaction.serialize(),
        );
      } catch (error) {
        if (!(error instanceof SendTransactionError)) {
          // Anything but the node rejecting the transaction (e.g. a
          // transport error) is ambiguous - the transaction may have been
          // forwarded and could still land, so retrying could create a
          // duplicate enqueue proposal. Throw out of the retry loop instead.
          console.error(
            `Sending the enqueue transaction failed without a node response. It may still land - check whether proposal ${enqueue.metadaoProposalPda.toBase58()} gets created before re-running.`,
          );
          throw error;
        }
        // The node rejected the transaction at preflight, so nothing was
        // broadcast
        console.warn(`Enqueue attempt ${attempt} of ${attempts} rejected`);
        lastError = error;
        continue;
      }

      let status: RpcResponseAndContext<SignatureResult>;
      try {
        status = await provider.connection.confirmTransaction(
          signature,
          "confirmed",
        );
      } catch (error) {
        // The timeout is ambiguous - the transaction may still land, so
        // retrying could create a duplicate enqueue proposal. Throw out of
        // the retry loop instead.
        console.error(
          `Confirmation of enqueue transaction ${signature} timed out. It may still land - check it before re-running, or a duplicate enqueue proposal could be created.`,
        );
        throw error;
      }

      if (status.value.err) {
        // Landed on-chain but failed, consuming only the transaction fee
        console.warn(
          `Enqueue attempt ${attempt} of ${attempts} failed on-chain`,
        );
        lastError = new Error(
          `Enqueue transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
        );
        continue;
      }

      return { ...enqueue, metadaoSignature: signature };
    }

    throw lastError;
  };

  const {
    metadaoTransactionIndex,
    metadaoVaultTransactionPda,
    metadaoProposalPda,
    metadaoSignature,
  } = await sendEnqueueTransactionWithRetries(3);

  console.log("Enqueue approval squads transaction created!");
  console.log("Transaction signature:", metadaoSignature);
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
