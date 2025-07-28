import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC } from "../consts.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("B3AufDZCDtQN8JxZgJ5bSDZaiKCF4vtw7ynN9tuR9pXN");
const SPENDING_ADDRESS = new PublicKey("5jRqFejxKHWMfR69dbYF2A9TnpnBPjz7iaRQS44imcMi"); // NOTE: This is your wallet address
const SPENDING_AMOUNT = 10_000; // in USDC

async function main() {
  if (payer.publicKey.toBase58() !== SPENDING_ADDRESS.toBase58()) {
    throw new Error("Payer address does not match spending address");
  }

  const [multisigPDA] = multisig.getMultisigPda({
    createKey: DAO_ADDRESS,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPDA,
    createKey: DAO_ADDRESS,
  });

  const spendingLimitAccount = await multisig.accounts.SpendingLimit.fromAccountAddress(
    provider.connection,
    spendingLimitPda
  );

  // Confirm the payer is a member of the spending limit
  const members = spendingLimitAccount.members.map(member => member.toBase58());
  if (!members.includes(payer.publicKey.toBase58())) {
    throw new Error("Payer is not a member of the spending limit");
  }

  // Get the associated token address for the spending token
  const spendingTokenAccount = getAssociatedTokenAddressSync(
    USDC,
    payer.publicKey,
    true
  );

  // Get the decimals for the token for use when spending
  const tokenAccountInfo = await provider.connection.getParsedAccountInfo(USDC);
  if (!tokenAccountInfo.value.data || typeof tokenAccountInfo.value.data === 'string' || 'parsed' in tokenAccountInfo.value.data === false) {
    throw new Error("Token account data is not parsed");
  }
  
  const spendingTokenDecimals = tokenAccountInfo.value.data.parsed.info.decimals;

  // With decimals, convert the amount from human to chain
  const amountConverted = SPENDING_AMOUNT * (10 ** spendingTokenDecimals);

  const ixs = [];
  try {
    // See if there is a token account and if it has a balance, if not, create it
    const tokenAccountInfo = await provider.connection.getAccountInfo(spendingTokenAccount);
    if (!tokenAccountInfo) {
      throw new Error("Token account not found");
    }

  } catch (error) {
    // Create the spending USDC account if it doesn't exist
    console.log("Token account not found, creating it");
    const createIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      spendingTokenAccount,
      payer.publicKey,
      USDC
    )
    ixs.push(createIx);
  }

  // Use the spending limit
  const ix = multisig.instructions.spendingLimitUse({
    multisigPda: multisigPDA,
    member: payer.publicKey,
    spendingLimit: spendingLimitPda,
    mint: USDC,
    vaultIndex: 0, // NOTE: If you have multiple vaults, you can use the vaultIndex to specify which vault to use
    amount: amountConverted,
    decimals: spendingTokenDecimals,
    destination: payer.publicKey,
  });

  ixs.push(ix);

  const tx = new Transaction().add(...ixs);
  const blockhash = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;
  tx.feePayer = payer.publicKey;
  tx.partialSign(payer);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");
  console.log(txHash);
}

main();