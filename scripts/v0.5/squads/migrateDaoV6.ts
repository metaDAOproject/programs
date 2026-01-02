import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import {
  PERMISSIONLESS_ACCOUNT,
  MAINNET_USDC,
  getMetadataAddr,
} from "@metadaoproject/futarchy/v0.5";
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  createTransferInstruction,
} from "@solana/spl-token";
import { getSquadsPdasFromDao } from "../../utils/squads.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createNoopSigner,
  signerIdentity,
  publicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

const provider = anchor.AnchorProvider.env();
const payer: Keypair = provider.wallet["payer"];

const MINT = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta"); // MetaDAO Token

// Configuration
const DAO_ADDRESS = new PublicKey(
  "Bc3pKPnSbSX8W2hTXbsFsybh1GeRtu3Qqpfu9ZLxg6Km",
);

const NEW_DAO_ADDRESS = new PublicKey(
  "CUPoiqkK4hxyCiJcLC4yE9AtJP1MoV1vFV2vx3jqwWeS",
);

// This will setup a transfer of
// USDC from existing DAO Squads to new DAO Squads
// Mint Authority of META to new Squads
// Update Authority of META to new Squads
async function main() {
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  const { multisigPda: newMultisigPda, vaultPda: newVaultPda } =
    await getSquadsPdasFromDao(NEW_DAO_ADDRESS);

  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
  console.log("Current transaction index:", currentTransactionIndex.toString());
  const transactionIndex = currentTransactionIndex + 1;

  console.log("Existing Vault Address:", vaultPda.toBase58());
  console.log("New Vault Address:", newVaultPda.toBase58());

  // Fetch USDC to Transfer
  const usdcAccount = getAssociatedTokenAddressSync(
    MAINNET_USDC,
    vaultPda,
    true,
  );
  const usdcToTransfer =
    await provider.connection.getTokenAccountBalance(usdcAccount);

  const destinationAccount = getAssociatedTokenAddressSync(
    MAINNET_USDC,
    newVaultPda,
    true,
  );

  console.log("USDC to Transfer:", usdcToTransfer.value.amount);

  // Transfer USDC
  const transferUsdcIx = createTransferInstruction(
    usdcAccount,
    destinationAccount,
    vaultPda,
    Number(usdcToTransfer.value.amount), // TODO: Review
  );

  // Transfer Update Authority
  // Use a noop signer since the vault will sign via Squads multisig
  const umi = createUmi(provider.connection);
  const vaultSigner = createNoopSigner(UmiPublicKey(vaultPda.toBase58()));
  umi.use(signerIdentity(vaultSigner));
  umi.use(mplTokenMetadata());

  const umiMint = UmiPublicKey(MINT.toBase58());
  const umiUpdateAuthority = UmiPublicKey(newVaultPda.toBase58()); // TODO: Confirm this.

  const asset = getMetadataAddr(MINT);

  const umiUpdateInstructions = updateMetadataAccountV2(umi, {
    newUpdateAuthority: umiUpdateAuthority,
    metadata: UmiPublicKey(asset[0].toBase58()),
  }).getInstructions();

  const updateMetadataInstructions = umiUpdateInstructions.map(
    (umiInstruction) => toWeb3JsInstruction(umiInstruction),
  );

  // Transfer Mint Authority
  const transferMintAuthorityIx = createSetAuthorityInstruction(
    MINT,
    vaultPda,
    AuthorityType.MintTokens,
    newVaultPda,
  );

  console.log("Transfer Mint Authority Instruction:", transferMintAuthorityIx);
  console.log("Update Metadata Instructions:");
  updateMetadataInstructions.map((ix) => console.log(ix));
  console.log("Transfer USDC Instruction:", transferUsdcIx);

  // Create the transaction message for the vault
  const transactionMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: [
      transferMintAuthorityIx,
      ...updateMetadataInstructions,
      transferUsdcIx,
    ],
  });

  // Create vault transaction
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey, // payer signs and pays rent for creating the vault tx
    vaultIndex: 0,
    ephemeralSigners: 0, // do we want to use ephemeral signers?
    transactionMessage,
  });

  // Create proposal
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey, // payer signs and pays rent for creating the proposal
    isDraft: false,
  });

  // Add both instructions to create the proposal
  const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;

  // Sign with both accounts
  tx.sign(payer, PERMISSIONLESS_ACCOUNT);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Transaction hash:", txHash);
  console.log("Proposal index:", transactionIndex.toString());

  // Get the proposal PDA
  const [proposalPda] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
  });
  console.log("Proposal PDA:", proposalPda.toBase58());
}

main().catch((error) => {
  console.error("Error creating transfer:", error);
  process.exit(1);
});
