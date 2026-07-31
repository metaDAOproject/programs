import { AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  Keypair,
  PublicKey,
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
  // The signer of the vault transaction's inner instructions
  daoMultisigVault: PublicKey;
  payer: PublicKey;
};

export type DaoAction = {
  // Executed by the DAO's squads vault inside the vault transaction
  instructions: TransactionInstruction[];
  // Payer-funded instructions sent up front, so the vault transaction can't
  // fail at execution time (e.g. creating token accounts)
  setupInstructions?: TransactionInstruction[];
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

  return async ({ provider, futarchy, dao, daoMultisigVault, payer }) => {
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

/**
 * Runs the action builders and routes their instructions through the admin
 * approval system. On top of buildAdminApprovalTransactions' result, returns
 * `setupTransaction` - a payer-funded transaction with the actions' setup
 * instructions (null if none), to be signed by the payer and sent before the
 * others.
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
 * squads transactions and proposals along the way. The ops multisig
 * transaction is built only after the DAO transaction confirms, so its
 * transaction index is read as late as possible.
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
  const {
    setupTransaction,
    daoTransaction,
    daoTransactionIndex,
    daoVaultTransactionPda,
    daoProposalPda,
    enqueuedApprovalPda,
    buildMetadaoTransaction,
  } = transactions;

  let setupSignature: string | null = null;
  if (setupTransaction) {
    setupTransaction.sign(payer);

    setupSignature = await provider.connection.sendRawTransaction(
      setupTransaction.serialize(),
    );
    await provider.connection.confirmTransaction(setupSignature, "confirmed");

    console.log("Setup transaction sent!");
    console.log("Transaction signature:", setupSignature);
  }

  daoTransaction.sign(payer, PERMISSIONLESS_ACCOUNT);

  const daoSignature = await provider.connection.sendRawTransaction(
    daoTransaction.serialize(),
  );
  await provider.connection.confirmTransaction(daoSignature, "confirmed");

  console.log("DAO squads transaction created!");
  console.log("Transaction signature:", daoSignature);
  console.log("Squads transaction index:", daoTransactionIndex.toString());
  console.log("Squads transaction:", daoVaultTransactionPda.toBase58());
  console.log("Squads proposal:", daoProposalPda.toBase58());

  // Built only now so the ops multisig's transaction index is fresh
  const {
    metadaoTransaction,
    metadaoTransactionIndex,
    metadaoVaultTransactionPda,
    metadaoProposalPda,
  } = await buildMetadaoTransaction();

  metadaoTransaction.sign(payer);

  const metadaoSignature = await provider.connection.sendRawTransaction(
    metadaoTransaction.serialize(),
  );
  await provider.connection.confirmTransaction(metadaoSignature, "confirmed");

  console.log("Enqueue approval squads transaction created!");
  console.log("Transaction signature:", metadaoSignature);
  console.log("Squads transaction index:", metadaoTransactionIndex.toString());
  console.log("Squads transaction:", metadaoVaultTransactionPda.toBase58());
  console.log("Squads proposal:", metadaoProposalPda.toBase58());
  console.log("Enqueued approval:", enqueuedApprovalPda.toBase58());
  console.log(
    "Go ahead and approve + execute the enqueue approval through Squads.",
  );

  return { setupSignature, daoSignature, metadaoSignature };
};
