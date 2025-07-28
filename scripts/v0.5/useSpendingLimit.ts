import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC } from "../consts.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("B3AufDZCDtQN8JxZgJ5bSDZaiKCF4vtw7ynN9tuR9pXN");
const SPENDING_AMOUNT = 10_000; // in human readable TOKEN AMOUNT (eg 10,000)
const MINT = USDC; // NOTE: This is the mint of the token you want to spend

// This will fetch the multisig, spending limit and the account details.
// This checks the mint of the spending limit and the mint of the token you want to spend.
// This checks for the payer being a member of the spending limit.
// This checks for the token account and creates it if it doesn't exist.
// This will spend the amount set above or the remaining amount of the spending limit, whichever is less.
async function main() { 
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

  if(spendingLimitAccount.mint.toBase58() !== MINT.toBase58()) {
    throw new Error("Spending limit mint does not match the mint");
  }

  const spendingLimitAmount = Number(spendingLimitAccount.amount.toString());
  const spendingLimitRemaining = Number(spendingLimitAccount.remainingAmount.toString());

  console.log(`Spending limit: ${spendingLimitAmount / 10 ** 6}`);
  console.log(`Spending limit remaining: ${spendingLimitRemaining / 10 ** 6}`);

  // Confirm the payer is a member of the spending limit
  const members = spendingLimitAccount.members.map(member => member.toBase58());
  if (!members.includes(payer.publicKey.toBase58())) {
    throw new Error("Payer is not a member of the spending limit");
  }

  // Get the associated token address for the spending token
  const spendingTokenAccount = getAssociatedTokenAddressSync(
    MINT,
    payer.publicKey,
    true
  );

  // Get the decimals for the token for use when spending
  const tokenAccountInfo = await provider.connection.getParsedAccountInfo(MINT);
  if (!tokenAccountInfo.value.data || typeof tokenAccountInfo.value.data === 'string' || 'parsed' in tokenAccountInfo.value.data === false) {
    throw new Error("Token account data is not parsed");
  }
  
  const spendingTokenDecimals = tokenAccountInfo.value.data.parsed.info.decimals;

  // With decimals, convert the amount from human to chain
  let amountConverted = SPENDING_AMOUNT * (10 ** spendingTokenDecimals);

  // If the spending limit remaining is less than the amount to spend, adjust the amount to spend to the remaining amount
  if (spendingLimitRemaining < amountConverted) {
    console.log(`Spending limit remaining is less than the amount to spend. Adjusting from ${SPENDING_AMOUNT} to ${spendingLimitRemaining / 10 ** 6}`);
    amountConverted = spendingLimitRemaining;
  }

  const ixs = [];
  try {
    // See if there is a token account and if it has a balance, if not, create it
    const tokenAccountInfo = await provider.connection.getAccountInfo(spendingTokenAccount);
    if (!tokenAccountInfo) {
      throw new Error("Token account not found");
    }
  } catch (error) {
    // Create the spending TOKEN account if it doesn't exist
    console.log("Token account not found, creating it");
    const createIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      spendingTokenAccount,
      payer.publicKey,
      MINT
    )
    ixs.push(createIx);
  }

  // Use the spending limit
  const ix = multisig.instructions.spendingLimitUse({
    multisigPda: multisigPDA,
    member: payer.publicKey,
    spendingLimit: spendingLimitPda,
    mint: MINT,
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