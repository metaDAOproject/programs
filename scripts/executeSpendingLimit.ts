import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { AutocratClient } from "../sdk/dist/v0.5/AutocratClient.js";
import { getProposalAddr } from "../sdk/dist/v0.5/utils/index.js";
import { AUTOCRAT_PROGRAM_ID } from "../sdk/dist/v0.5/constants.js";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("7QbVKbEuqqrEANBaViB1XxoH34hqiroDqf2twkcusnWk");
// const PROPOSAL_PDA = new PublicKey("Hh11b76gUQTfpuJLJqANxnm73zAHhQcj1MeKU44MJ93f");


// Returns the multisig, spending limit and 0th vault pda for a given dao address
export const getSquadsPdasFromDao = async (
  daoAddress: string | PublicKey,
): Promise<{
  multisigPda: PublicKey;
  spendingLimitPda: PublicKey;
  vaultPda: PublicKey;
}> => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPda,
    createKey: dao,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda: multisigPda,
    index: 0,
  });

  return {
    multisigPda,
    spendingLimitPda,
    vaultPda,
  };
};

const SQUADS_PROPOSAL_PDA = new PublicKey(
  "Hh11b76gUQTfpuJLJqANxnm73zAHhQcj1MeKU44MJ93f",
); 

export default async function main() {
  const autocrat = AutocratClient.createClient({ provider });

  const dao = await autocrat.getDao(DAO_ADDRESS);

  const { multisigPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  console.log("multisigPda", multisigPda);

  const [metaDaoProposal] = getProposalAddr(
    AUTOCRAT_PROGRAM_ID,
    SQUADS_PROPOSAL_PDA,
  );

  console.log("metaDaoProposal", metaDaoProposal);


  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);

  console.log("currentTransactionIndex", currentTransactionIndex);

  const [proposalKey, proposalBump] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: BigInt(currentTransactionIndex - 2),
  });

  console.log("proposalKey", proposalKey);
  
  const metaDAOProposal = new PublicKey("AgzgRxxUU2Xniw2bEp8boBcz56kZmM1Sa7y9qESk5vnV"); 

  const storedProposal = await autocrat.getProposal(metaDAOProposal);

  const [vaultTransactionPda] = multisig.getTransactionPda({
    multisigPda: multisigPda,
    index: BigInt(currentTransactionIndex - 2),
  });

  console.log("vaultTransactionPda", vaultTransactionPda.toBase58());

  const transactionAccount =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      provider.connection,
      vaultTransactionPda,
    );

  console.log("transactionAccount", transactionAccount.vaultIndex);
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
    programId: multisig.PROGRAM_ID,
  });

  console.log("vaultPda", vaultPda.toBase58());

  const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
    {
      connection: provider.connection,
      message: transactionAccount.message,
      ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
      vaultPda,
      transactionPda: vaultTransactionPda,
      programId: multisig.PROGRAM_ID,
    },
  );

  console.log("accountMetas", accountMetas);

  const tx = await autocrat.autocrat.methods
    .executeSpendingLimitChange()
    .accounts({
      squadsMultisig: multisigPda,
      proposal: metaDAOProposal,
      dao: DAO_ADDRESS,
      squadsProposal: SQUADS_PROPOSAL_PDA,
      squadsMultisigProgram: multisig.PROGRAM_ID,
      vaultTransaction: vaultTransactionPda,
    })
    .remainingAccounts(
      accountMetas.map((meta) =>
        meta.pubkey.equals(DAO_ADDRESS) ? { ...meta, isSigner: false } : meta,
      ),
    )
    .transaction();

  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.partialSign(payer);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  console.log(`executeSpendingLimitChange transaction sent:`, txHash); 
  // const tx = await provider.sendAndConfirmTransaction(transaction);

}

main();