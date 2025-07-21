import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { USDC } from "./consts.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const SQUADS_VAULT_ADDRESS = new PublicKey("7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY");
const SPENDING_ADDRESS = new PublicKey("CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf");
const SPENDING_AMOUNT = 5; // in USDC

async function main() {
  const multisigPda = SQUADS_VAULT_ADDRESS;
  const ixs = [];
  const createIx = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    getAssociatedTokenAddressSync(
      USDC,
      payer.publicKey,
      true
    ),
    SPENDING_ADDRESS,
    USDC
  )
  ixs.push(createIx);
  const ix = multisig.instructions.spendingLimitUse({
    multisigPda,
    member: SPENDING_ADDRESS,
    spendingLimit: SPENDING_ADDRESS,
    mint: USDC,
    vaultIndex: 0,
    amount: SPENDING_AMOUNT * 10 ** 6,
    decimals: 6,
    destination: SPENDING_ADDRESS,
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